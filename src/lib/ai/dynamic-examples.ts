/**
 * Codebase-Aware Few-Shot Selection — selects examples that match
 * the project's coding style and patterns.
 * Phase 4.10: Detects project style, selects relevant examples,
 * and adapts them to match project conventions.
 */

export type ProjectStyle = {
  language: string;
  framework?: string;
  patterns: string[];
  conventions: {
    semicolons: boolean;
    quotes: 'single' | 'double';
    indentation: 'tabs' | 'spaces';
    indentSize: number;
  };
};

type ExampleEntry = {
  task: string;
  solution: string;
  language: string;
  framework?: string;
  tags: string[];
};

/**
 * Built-in example bank organized by task type.
 * These serve as templates that get adapted to the project's style.
 */
const EXAMPLE_BANK: ExampleEntry[] = [
  {
    task: 'Create a utility function with error handling',
    solution: `export function parseJSON<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}`,
    language: 'typescript',
    framework: undefined,
    tags: ['utility', 'error-handling', 'parsing'],
  },
  {
    task: 'Create a React component with props',
    solution: `interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}`,
    language: 'typescript',
    framework: 'react',
    tags: ['component', 'react', 'ui'],
  },
  {
    task: 'Create an Express route handler',
    solution: `import { Request, Response, NextFunction } from 'express';

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = await UserService.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    next(error);
  }
}`,
    language: 'typescript',
    framework: 'express',
    tags: ['api', 'route', 'express', 'error-handling'],
  },
  {
    task: 'Create a class with dependency injection',
    solution: `export class UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return row ? this.mapToUser(row) : null;
  }

  private mapToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
    };
  }
}`,
    language: 'typescript',
    framework: undefined,
    tags: ['class', 'repository', 'database', 'dependency-injection'],
  },
  {
    task: 'Create a Python FastAPI endpoint',
    solution: `from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class CreateItemRequest(BaseModel):
    name: str
    price: float
    description: str | None = None

@router.post("/items")
async def create_item(request: CreateItemRequest):
    item = await ItemService.create(request.dict())
    if not item:
        raise HTTPException(status_code=400, detail="Failed to create item")
    return {"id": item.id, "name": item.name}`,
    language: 'python',
    framework: 'fastapi',
    tags: ['api', 'endpoint', 'fastapi', 'validation'],
  },
  {
    task: 'Create a test with mocking',
    solution: `import { describe, it, expect, vi } from 'vitest';
import { UserService } from './user-service';

describe('UserService', () => {
  it('should return user by id', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
    };
    const service = new UserService(mockDb as any);
    const user = await service.findById('1');
    expect(user).toEqual({ id: '1', name: 'Alice' });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('id'), ['1']);
  });
});`,
    language: 'typescript',
    framework: undefined,
    tags: ['test', 'mock', 'vitest', 'unit-test'],
  },
  {
    task: 'Create a functional data transformation pipeline',
    solution: `type Transform<T, U> = (input: T) => U;

export function pipe<A, B>(fn1: Transform<A, B>): Transform<A, B>;
export function pipe<A, B, C>(fn1: Transform<A, B>, fn2: Transform<B, C>): Transform<A, C>;
export function pipe(...fns: Transform<unknown, unknown>[]): Transform<unknown, unknown> {
  return (input: unknown) => fns.reduce((acc, fn) => fn(acc), input);
}

export const filterNulls = <T>(items: (T | null | undefined)[]): T[] =>
  items.filter((item): item is T => item != null);

export const groupBy = <T>(items: T[], key: keyof T): Record<string, T[]> =>
  items.reduce((acc, item) => {
    const group = String(item[key]);
    (acc[group] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);`,
    language: 'typescript',
    framework: undefined,
    tags: ['functional', 'utility', 'pipeline', 'data-transformation'],
  },
  {
    task: 'Create a JavaScript module with CommonJS exports',
    solution: `const crypto = require('crypto')

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return { salt, hash }
}

function verifyPassword(password, salt, hash) {
  const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return computed === hash
}

module.exports = { generateToken, hashPassword, verifyPassword }`,
    language: 'javascript',
    framework: undefined,
    tags: ['utility', 'crypto', 'commonjs', 'security'],
  },
];

/**
 * Detect whether files use semicolons.
 */
function detectSemicolons(files: { content: string }[]): boolean {
  let withSemicolons = 0;
  let withoutSemicolons = 0;

  for (const file of files) {
    const lines = file.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      if (trimmed.startsWith('import ') || trimmed.startsWith('export ') || trimmed.includes('=')) {
        if (trimmed.endsWith(';')) {
          withSemicolons++;
        } else if (!trimmed.endsWith('{') && !trimmed.endsWith(',') && !trimmed.endsWith('(')) {
          withoutSemicolons++;
        }
      }
    }
  }

  return withSemicolons >= withoutSemicolons;
}

/**
 * Detect quote style preference.
 */
function detectQuotes(files: { content: string }[]): 'single' | 'double' {
  let singleCount = 0;
  let doubleCount = 0;

  for (const file of files) {
    // Count string literals (excluding template literals and JSX attributes)
    const singles = file.content.match(/'[^']*'/g);
    const doubles = file.content.match(/"[^"]*"/g);
    singleCount += singles?.length ?? 0;
    doubleCount += doubles?.length ?? 0;
  }

  return singleCount >= doubleCount ? 'single' : 'double';
}

/**
 * Detect indentation style and size.
 */
function detectIndentation(files: { content: string }[]): { style: 'tabs' | 'spaces'; size: number } {
  let tabLines = 0;
  let spaceLines = 0;
  const spaceCounts: Record<number, number> = {};

  for (const file of files) {
    const lines = file.content.split('\n');
    for (const line of lines) {
      if (line.startsWith('\t')) {
        tabLines++;
      } else {
        const match = line.match(/^( +)\S/);
        if (match) {
          spaceLines++;
          const count = match[1].length;
          spaceCounts[count] = (spaceCounts[count] || 0) + 1;
        }
      }
    }
  }

  const style: 'tabs' | 'spaces' = tabLines > spaceLines ? 'tabs' : 'spaces';

  // Determine indent size from most common space count
  let indentSize = 2;
  if (style === 'spaces') {
    // Find the smallest common indentation that divides most counts
    const counts = Object.entries(spaceCounts)
      .map(([size, freq]) => ({ size: parseInt(size), freq }))
      .sort((a, b) => b.freq - a.freq);

    if (counts.length > 0) {
      // The most common indent is likely the base indent size
      const candidates = [2, 4, 8];
      let bestCandidate = 2;
      let bestScore = 0;

      for (const candidate of candidates) {
        const score = counts
          .filter((c) => c.size % candidate === 0)
          .reduce((sum, c) => sum + c.freq, 0);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
      indentSize = bestCandidate;
    }
  }

  return { style, size: indentSize };
}

/**
 * Detect framework from file contents and paths.
 */
function detectFramework(files: { path: string; content: string }[]): string | undefined {
  const allContent = files.map((f) => f.content).join('\n');
  const allPaths = files.map((f) => f.path).join('\n');

  // React detection
  if (
    allContent.includes('from "react"') ||
    allContent.includes("from 'react'") ||
    allContent.includes('require("react")') ||
    allPaths.includes('.jsx') ||
    allPaths.includes('.tsx')
  ) {
    // Check for Next.js
    if (allPaths.includes('pages/') || allPaths.includes('app/') || allContent.includes('next/')) {
      return 'nextjs';
    }
    return 'react';
  }

  // Express detection
  if (allContent.includes('express') && allContent.includes('app.')) {
    return 'express';
  }

  // FastAPI detection
  if (allContent.includes('fastapi') || allContent.includes('FastAPI')) {
    return 'fastapi';
  }

  // Vue detection
  if (allContent.includes('defineComponent') || allPaths.includes('.vue')) {
    return 'vue';
  }

  // Svelte detection
  if (allPaths.includes('.svelte')) {
    return 'svelte';
  }

  return undefined;
}

/**
 * Detect coding patterns from file contents.
 */
function detectPatterns(files: { content: string }[]): string[] {
  const patterns: string[] = [];
  const allContent = files.map((f) => f.content).join('\n');

  // Functional vs class-based
  const classCount = (allContent.match(/\bclass\s+\w/g) || []).length;
  const arrowCount = (allContent.match(/=>\s*[{(]/g) || []).length;
  const functionCount = (allContent.match(/\bfunction\s+\w/g) || []).length;

  if (classCount > arrowCount && classCount > functionCount) {
    patterns.push('class-based');
  } else if (arrowCount > classCount) {
    patterns.push('functional');
  }

  // Async patterns
  if (allContent.includes('async ') || allContent.includes('await ')) {
    patterns.push('async-await');
  }
  if (allContent.includes('.then(')) {
    patterns.push('promise-chains');
  }

  // Module style
  if (allContent.includes('import ') && allContent.includes('export ')) {
    patterns.push('esm');
  }
  if (allContent.includes('require(') && allContent.includes('module.exports')) {
    patterns.push('commonjs');
  }

  // Error handling style
  if (allContent.includes('try {') || allContent.includes('try{')) {
    patterns.push('try-catch');
  }
  if (allContent.includes('Result<') || allContent.includes('Either<')) {
    patterns.push('result-types');
  }

  // Testing patterns
  if (allContent.includes('describe(') && allContent.includes('it(')) {
    patterns.push('bdd-testing');
  }
  if (allContent.includes('test(')) {
    patterns.push('test-functions');
  }

  return patterns;
}

/**
 * Detect the primary language from file extensions.
 */
function detectLanguage(files: { path: string }[]): string {
  const extCounts: Record<string, number> = {};

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    const lang = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      kt: 'kotlin',
      cs: 'csharp',
    }[ext];

    if (lang) {
      extCounts[lang] = (extCounts[lang] || 0) + 1;
    }
  }

  const sorted = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'typescript';
}

/**
 * Detect project coding style from existing files.
 * Analyzes the first N files to determine conventions.
 */
export function detectProjectStyle(files: { path: string; content: string }[]): ProjectStyle {
  // Use up to 10 files for detection
  const sample = files.slice(0, 10);

  const language = detectLanguage(sample);
  const framework = detectFramework(sample);
  const patterns = detectPatterns(sample);
  const indentation = detectIndentation(sample);

  return {
    language,
    framework,
    patterns,
    conventions: {
      semicolons: detectSemicolons(sample),
      quotes: detectQuotes(sample),
      indentation: indentation.style,
      indentSize: indentation.size,
    },
  };
}

/**
 * Score how well an example matches the project style and task.
 */
function scoreExample(example: ExampleEntry, taskType: string, style: ProjectStyle): number {
  let score = 0;

  // Language match is critical
  if (example.language === style.language) {
    score += 0.4;
  } else {
    return 0; // Wrong language examples are useless
  }

  // Framework match
  if (style.framework && example.framework === style.framework) {
    score += 0.3;
  } else if (!example.framework) {
    score += 0.1; // Generic examples are okay
  }

  // Tag/task type relevance
  const taskWords = taskType.toLowerCase().split(/[\s-_]+/);
  for (const tag of example.tags) {
    if (taskWords.some((w) => tag.includes(w) || w.includes(tag))) {
      score += 0.1;
    }
  }

  // Pattern match
  if (style.patterns.includes('functional') && example.solution.includes('=>')) {
    score += 0.05;
  }
  if (style.patterns.includes('class-based') && example.solution.includes('class ')) {
    score += 0.05;
  }

  return Math.min(1, score);
}

/**
 * Select and adapt few-shot examples to match project style.
 * Returns examples sorted by relevance, adapted to project conventions.
 */
export function selectAdaptedExamples(
  taskType: string,
  projectStyle: ProjectStyle,
  maxExamples: number = 2
): { task: string; solution: string }[] {
  // Score all examples
  const scored = EXAMPLE_BANK
    .map((example) => ({
      example,
      score: scoreExample(example, taskType, projectStyle),
    }))
    .filter((item) => item.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples);

  // Adapt selected examples to project style
  return scored.map(({ example }) => ({
    task: example.task,
    solution: adaptToStyle(example.solution, projectStyle),
  }));
}

/**
 * Adapt a code example to match project conventions.
 * Converts quotes, semicolons, and indentation to match the target style.
 */
export function adaptToStyle(code: string, style: ProjectStyle): string {
  let adapted = code;

  // Adapt quotes
  if (style.conventions.quotes === 'single') {
    // Convert double quotes to single (but not in template literals or JSX)
    adapted = adapted.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, content) => {
      // Don't convert if it contains a single quote (would need escaping)
      if (content.includes("'")) return match;
      // Don't convert JSX attributes in the middle of tags
      if (match.includes('\\n') || match.includes('\\t')) return match;
      return `'${content}'`;
    });
  } else {
    // Convert single quotes to double
    adapted = adapted.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, content) => {
      if (content.includes('"')) return match;
      return `"${content}"`;
    });
  }

  // Adapt semicolons
  if (!style.conventions.semicolons) {
    // Remove trailing semicolons (but not from for loops, etc.)
    adapted = adapted.replace(/;(\s*$)/gm, '$1');
    adapted = adapted.replace(/;(\s*\/\/)/gm, '$1');
  } else {
    // Add semicolons to lines that should have them
    const lines = adapted.split('\n');
    adapted = lines
      .map((line) => {
        const trimmed = line.trimEnd();
        if (
          trimmed.length === 0 ||
          trimmed.endsWith('{') ||
          trimmed.endsWith('}') ||
          trimmed.endsWith(',') ||
          trimmed.endsWith(';') ||
          trimmed.endsWith('(') ||
          trimmed.endsWith(':') ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('import ') ||
          trimmed.startsWith('export ') ||
          /^\s*(if|else|for|while|switch|case|try|catch|finally)\b/.test(trimmed)
        ) {
          return line;
        }
        // Add semicolon to statement-like lines
        if (/^[\s]*(const|let|var|return|throw)\b/.test(trimmed) && !trimmed.endsWith(';')) {
          return line + ';';
        }
        return line;
      })
      .join('\n');
  }

  // Adapt indentation
  const currentIndent = adapted.includes('\t') ? '\t' : '  ';
  const targetIndent = style.conventions.indentation === 'tabs' ? '\t' : ' '.repeat(style.conventions.indentSize);

  if (currentIndent !== targetIndent) {
    const lines = adapted.split('\n');
    adapted = lines
      .map((line) => {
        // Count current indentation level
        let level = 0;
        let i = 0;
        while (i < line.length) {
          if (line[i] === '\t') {
            level++;
            i++;
          } else if (line[i] === ' ') {
            // Count spaces as one indent level per currentIndent width
            const indentWidth = currentIndent === '\t' ? 1 : currentIndent.length;
            let spaces = 0;
            while (i < line.length && line[i] === ' ') {
              spaces++;
              i++;
            }
            level += Math.round(spaces / indentWidth);
            break;
          } else {
            break;
          }
        }

        const content = line.trimStart();
        return content.length === 0 ? '' : targetIndent.repeat(level) + content;
      })
      .join('\n');
  }

  return adapted;
}
