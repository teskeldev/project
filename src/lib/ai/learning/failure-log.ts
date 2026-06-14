/**
 * Self-Improvement Loop — learns from past failures to avoid repeating mistakes.
 * Phase 4.7: Stores failure patterns and injects relevant warnings into future prompts.
 * Uses in-memory storage with optional persistence hooks.
 */

export type FailureRecord = {
  id: string;
  timestamp: Date;
  taskType: string;
  modelId: string;
  errorType: string;
  errorMessage: string;
  context: string;
  resolution?: string;
  preventionHint: string;
};

export type FailureLog = {
  records: FailureRecord[];
  maxRecords: number;
};

type FailureInput = Omit<FailureRecord, 'id' | 'timestamp'>;

/**
 * In-memory failure store.
 * Indexed by task type and model for fast retrieval.
 */
const store: FailureLog = {
  records: [],
  maxRecords: 500,
};

/** Index maps for fast lookup */
const byTaskType = new Map<string, FailureRecord[]>();
const byModel = new Map<string, FailureRecord[]>();
const byErrorType = new Map<string, FailureRecord[]>();

/**
 * Generate a unique ID for a failure record.
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `fail_${timestamp}_${random}`;
}

/**
 * Add a record to an index map.
 */
function addToIndex(map: Map<string, FailureRecord[]>, key: string, record: FailureRecord): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(record);
  } else {
    map.set(key, [record]);
  }
}

/**
 * Remove a record from all index maps.
 */
function removeFromIndices(record: FailureRecord): void {
  const removeFrom = (map: Map<string, FailureRecord[]>, key: string) => {
    const list = map.get(key);
    if (list) {
      const idx = list.indexOf(record);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) map.delete(key);
    }
  };

  removeFrom(byTaskType, record.taskType);
  removeFrom(byModel, record.modelId);
  removeFrom(byErrorType, record.errorType);
}

/**
 * Enforce the maximum record limit by removing oldest entries.
 */
function enforceLimit(): void {
  while (store.records.length > store.maxRecords) {
    const oldest = store.records.shift();
    if (oldest) {
      removeFromIndices(oldest);
    }
  }
}

/**
 * Log a failure for future learning.
 * Records are stored in memory and indexed for fast retrieval.
 */
export function logFailure(input: FailureInput): void {
  const record: FailureRecord = {
    ...input,
    id: generateId(),
    timestamp: new Date(),
  };

  store.records.push(record);
  addToIndex(byTaskType, record.taskType, record);
  addToIndex(byModel, record.modelId, record);
  addToIndex(byErrorType, record.errorType, record);

  enforceLimit();
}

/**
 * Calculate keyword overlap between two strings.
 * Returns a score between 0 and 1.
 */
function keywordOverlap(a: string, b: string): number {
  const wordsA = new Set(
    a.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    b.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of Array.from(wordsA)) {
    if (wordsB.has(word)) overlap++;
  }

  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * Score a failure record's relevance to the current task.
 */
function scoreRelevance(
  record: FailureRecord,
  taskType: string,
  modelId: string,
  context?: string
): number {
  let score = 0;

  // Exact task type match is highly relevant
  if (record.taskType === taskType) {
    score += 0.4;
  } else if (record.taskType.includes(taskType) || taskType.includes(record.taskType)) {
    score += 0.2;
  }

  // Same model is more relevant
  if (record.modelId === modelId) {
    score += 0.3;
  }

  // Context keyword overlap
  if (context && record.context) {
    score += keywordOverlap(context, record.context) * 0.3;
  }

  // Recency bonus — more recent failures are more relevant
  const ageMs = Date.now() - record.timestamp.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) {
    score += 0.1;
  } else if (ageHours < 24) {
    score += 0.05;
  }

  // Records with resolutions are more useful
  if (record.resolution) {
    score += 0.05;
  }

  return score;
}

/**
 * Get relevant failure warnings for a new task.
 * Matches by task type, model, and keyword overlap with context.
 * Returns prevention hints sorted by relevance.
 */
export function getRelevantWarnings(
  taskType: string,
  modelId: string,
  context?: string,
  maxWarnings: number = 3
): string[] {
  // Gather candidate records from indices
  const candidates = new Set<FailureRecord>();

  const taskRecords = byTaskType.get(taskType);
  if (taskRecords) {
    for (const r of taskRecords) candidates.add(r);
  }

  const modelRecords = byModel.get(modelId);
  if (modelRecords) {
    for (const r of modelRecords) candidates.add(r);
  }

  // If we have very few candidates, search all records
  if (candidates.size < maxWarnings * 2) {
    for (const r of store.records) candidates.add(r);
  }

  // Score and sort candidates
  const scored = Array.from(candidates)
    .map((record) => ({
      record,
      relevance: scoreRelevance(record, taskType, modelId, context),
    }))
    .filter((item) => item.relevance > 0.2)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxWarnings);

  // Deduplicate similar warnings
  const seen = new Set<string>();
  const warnings: string[] = [];

  for (const { record } of scored) {
    const hint = record.preventionHint.trim();
    // Simple dedup: skip if we've seen a very similar hint
    const normalized = hint.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      warnings.push(hint);
    }
  }

  return warnings;
}

/**
 * Format warnings as a prompt section to inject into AI prompts.
 */
export function formatWarningsForPrompt(warnings: string[]): string {
  if (warnings.length === 0) return '';

  const lines = [
    '⚠️ LEARNED FROM PAST MISTAKES — avoid these issues:',
    '',
  ];

  for (let i = 0; i < warnings.length; i++) {
    lines.push(`${i + 1}. ${warnings[i]}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get failure statistics grouped by error type and model.
 */
export function getFailureStats(): {
  byType: Record<string, number>;
  byModel: Record<string, number>;
  total: number;
} {
  const byTypeStats: Record<string, number> = {};
  const byModelStats: Record<string, number> = {};

  for (const [type, records] of Array.from(byErrorType.entries())) {
    byTypeStats[type] = records.length;
  }

  for (const [model, records] of Array.from(byModel.entries())) {
    byModelStats[model] = records.length;
  }

  return {
    byType: byTypeStats,
    byModel: byModelStats,
    total: store.records.length,
  };
}

/**
 * Clear old records beyond a maximum age.
 * @param maxAge Maximum age in milliseconds (default: 7 days)
 * @returns Number of records pruned
 */
export function pruneOldRecords(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAge;
  const toRemove: FailureRecord[] = [];

  for (const record of store.records) {
    if (record.timestamp.getTime() < cutoff) {
      toRemove.push(record);
    }
  }

  for (const record of toRemove) {
    const idx = store.records.indexOf(record);
    if (idx !== -1) {
      store.records.splice(idx, 1);
    }
    removeFromIndices(record);
  }

  return toRemove.length;
}

/**
 * Reset the entire failure log (useful for testing).
 */
export function reset(): void {
  store.records.length = 0;
  byTaskType.clear();
  byModel.clear();
  byErrorType.clear();
}

/**
 * Export all records for persistence.
 */
export function exportRecords(): FailureRecord[] {
  return [...store.records];
}

/**
 * Import records from persistent storage.
 */
export function importRecords(records: FailureRecord[]): void {
  for (const record of records) {
    // Ensure timestamp is a Date object
    const normalized: FailureRecord = {
      ...record,
      timestamp: record.timestamp instanceof Date ? record.timestamp : new Date(record.timestamp),
    };

    store.records.push(normalized);
    addToIndex(byTaskType, normalized.taskType, normalized);
    addToIndex(byModel, normalized.modelId, normalized);
    addToIndex(byErrorType, normalized.errorType, normalized);
  }

  enforceLimit();
}
