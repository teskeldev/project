/**
 * Model-specific prompt adaptation layer.
 * Optimizes prompt format, structure, and instructions for each model family
 * to maximize code generation quality.
 */

export type ModelFamily =
  | 'openai-gpt4'      // GPT-4o, GPT-4-turbo
  | 'openai-mini'      // GPT-4o-mini
  | 'anthropic-claude' // Claude 3.5/4/Fable
  | 'llama'            // Llama 3.x (via Groq or local)
  | 'mistral'          // Mistral/Mixtral
  | 'qwen'            // Qwen 2.5 Coder
  | 'deepseek'        // DeepSeek Coder
  | 'phi'             // Phi-4
  | 'gemma'           // Gemma 2
  | 'generic';        // Unknown/fallback

export type PromptRole = 'system' | 'user' | 'assistant';

export type AdaptedPrompt = {
  messages: { role: PromptRole; content: string }[];
  systemPrompt: string;
  modelFamily: ModelFamily;
  adaptations: string[];  // List of adaptations applied
};

export type AdaptOptions = {
  modelId: string;
  provider?: string;
  taskType: 'code_generation' | 'bug_fix' | 'refactoring' | 'test_writing' |
            'code_review' | 'planning' | 'explanation' | 'completion';
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: { role: PromptRole; content: string }[];
  codeContext?: string;       // Relevant code to include
  outputFormat?: 'freeform' | 'json' | 'xml' | 'diff' | 'search_replace';
};

// ---------------------------------------------------------------------------
// Model Family Detection
// ---------------------------------------------------------------------------

/** Detect model family from model ID string */
export function detectModelFamily(modelId: string, provider?: string): ModelFamily {
  const id = modelId.toLowerCase().trim();
  const prov = provider?.toLowerCase().trim() ?? '';

  // Provider hint: Groq with llama
  if (prov === 'groq' && id.includes('llama')) return 'llama';

  // OpenAI models
  if (id.includes('gpt-4o-mini') || id.includes('gpt-4-mini')) return 'openai-mini';
  if (id.includes('gpt-4') || id.includes('gpt4')) return 'openai-gpt4';
  if (id.includes('o1') || id.includes('o3') || id.includes('o4')) return 'openai-gpt4';

  // Anthropic
  if (id.includes('claude')) return 'anthropic-claude';

  // Llama
  if (id.includes('llama') || id.startsWith('meta-llama')) return 'llama';

  // Mistral / Mixtral
  if (id.includes('mistral') || id.includes('mixtral')) return 'mistral';

  // Qwen
  if (id.includes('qwen')) return 'qwen';

  // DeepSeek
  if (id.includes('deepseek')) return 'deepseek';

  // Phi
  if (id.includes('phi-') || id.startsWith('phi')) return 'phi';

  // Gemma
  if (id.includes('gemma')) return 'gemma';

  // Provider-based fallback
  if (prov === 'anthropic') return 'anthropic-claude';
  if (prov === 'openai') return 'openai-gpt4';

  return 'generic';
}

// ---------------------------------------------------------------------------
// Adaptation Strategies
// ---------------------------------------------------------------------------

type AdaptationStrategy = {
  formatSystemPrompt: (prompt: string, taskType: AdaptOptions['taskType']) => string;
  formatUserMessage: (message: string, codeContext?: string) => string;
  maxSystemLength?: number;
  prefersXml: boolean;
  prefersMarkdown: boolean;
  needsExplicitConstraints: boolean;
  supportsLongContext: boolean;
};

const strategies: Record<ModelFamily, AdaptationStrategy> = {
  'openai-gpt4': {
    formatSystemPrompt(prompt, _taskType) {
      return prompt;
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `## Context\n\n\`\`\`\n${codeContext}\n\`\`\`\n\n## Request\n\n${message}`;
      }
      return message;
    },
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: false,
    supportsLongContext: true,
  },

  'openai-mini': {
    formatSystemPrompt(prompt, taskType) {
      // Shorter system prompts for mini; add step-by-step for complex tasks
      const truncated = truncatePrompt(prompt, 2000);
      const complexTasks: AdaptOptions['taskType'][] = [
        'code_generation', 'refactoring', 'bug_fix',
      ];
      if (complexTasks.includes(taskType)) {
        return `${truncated}\n\nThink step by step before providing your answer.`;
      }
      return truncated;
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `## Context\n\n\`\`\`\n${codeContext}\n\`\`\`\n\n## Request\n\n${message}`;
      }
      return message;
    },
    maxSystemLength: 2000,
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: true,
    supportsLongContext: false,
  },

  'anthropic-claude': {
    formatSystemPrompt(prompt, _taskType) {
      return prompt;
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `<context>\n${codeContext}\n</context>\n\n<instructions>\n${message}\n</instructions>`;
      }
      return `<instructions>\n${message}\n</instructions>`;
    },
    prefersXml: true,
    prefersMarkdown: true,
    needsExplicitConstraints: false,
    supportsLongContext: true,
  },

  'llama': {
    formatSystemPrompt(prompt, _taskType) {
      return truncatePrompt(prompt, 1500);
    },
    formatUserMessage(message, codeContext) {
      let result = '';
      if (codeContext) {
        result += `Code:\n\`\`\`\n${codeContext}\n\`\`\`\n\n`;
      }
      result += `Task: ${message}`;
      return result;
    },
    maxSystemLength: 1500,
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: true,
    supportsLongContext: false,
  },

  'mistral': {
    formatSystemPrompt(prompt, _taskType) {
      return truncatePrompt(prompt, 2500);
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `---\n${codeContext}\n---\n\n${message}`;
      }
      return message;
    },
    maxSystemLength: 2500,
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: true,
    supportsLongContext: true,
  },

  'qwen': {
    formatSystemPrompt(prompt, _taskType) {
      // Qwen responds well to role-playing
      if (!prompt.toLowerCase().includes('you are')) {
        return `You are a senior software engineer with deep expertise in code quality.\n\n${prompt}`;
      }
      return prompt;
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `<code>\n${codeContext}\n</code>\n\n${message}`;
      }
      return message;
    },
    prefersXml: true,
    prefersMarkdown: true,
    needsExplicitConstraints: false,
    supportsLongContext: true,
  },

  'deepseek': {
    formatSystemPrompt(prompt, _taskType) {
      return prompt;
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `\`\`\`\n${codeContext}\n\`\`\`\n\n${message}`;
      }
      return message;
    },
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: false,
    supportsLongContext: true,
  },

  'phi': {
    formatSystemPrompt(prompt, _taskType) {
      return truncatePrompt(prompt, 1500);
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `Context code:\n\`\`\`\n${codeContext}\n\`\`\`\n\nTask: ${message}`;
      }
      return `Task: ${message}`;
    },
    maxSystemLength: 1500,
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: true,
    supportsLongContext: false,
  },

  'gemma': {
    formatSystemPrompt(prompt, _taskType) {
      return truncatePrompt(prompt, 2000);
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `Reference code:\n\`\`\`\n${codeContext}\n\`\`\`\n\n${message}`;
      }
      return message;
    },
    maxSystemLength: 2000,
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: true,
    supportsLongContext: false,
  },

  'generic': {
    formatSystemPrompt(prompt, _taskType) {
      return prompt;
    },
    formatUserMessage(message, codeContext) {
      if (codeContext) {
        return `\`\`\`\n${codeContext}\n\`\`\`\n\n${message}`;
      }
      return message;
    },
    prefersXml: false,
    prefersMarkdown: true,
    needsExplicitConstraints: true,
    supportsLongContext: true,
  },
};

// ---------------------------------------------------------------------------
// Task Instructions
// ---------------------------------------------------------------------------

type TaskInstructionSet = {
  strong: string;  // For capable models (gpt4, claude, deepseek)
  weak: string;    // For smaller/weaker models (mini, llama-8b, phi, gemma)
};

const taskInstructions: Record<AdaptOptions['taskType'], TaskInstructionSet> = {
  code_generation: {
    strong: [
      'Implement the following. Consider edge cases, error handling, and type safety.',
      'Follow existing code patterns and conventions in the project.',
      'Include appropriate comments for complex logic.',
    ].join(' '),
    weak: [
      'Implement ONLY the requested function. Do NOT add extra code.',
      'Follow the exact signature provided.',
      'Handle basic errors. Keep it simple and correct.',
      'Do NOT include explanations outside of code comments.',
    ].join(' '),
  },

  bug_fix: {
    strong: [
      '1. Identify the root cause of the bug.',
      '2. Explain the fix briefly.',
      '3. Provide the minimal change needed to fix the issue.',
      'Do not refactor unrelated code.',
    ].join(' '),
    weak: [
      '1. Find the bug.',
      '2. Fix ONLY the broken lines.',
      '3. Do NOT rewrite the entire file.',
      '4. Do NOT change code that is already working.',
      'Show only the minimal fix.',
    ].join(' '),
  },

  refactoring: {
    strong: [
      'Preserve all existing behavior. Only change structure, naming, or organization.',
      'Run through each change mentally to verify no behavior change.',
      'Maintain the same public API unless explicitly asked to change it.',
    ].join(' '),
    weak: [
      'IMPORTANT: Do NOT change what the code does. Only change HOW it is organized.',
      'Keep the same inputs and outputs.',
      'Do NOT add new features or fix bugs during refactoring.',
      'Make small, safe changes.',
    ].join(' '),
  },

  test_writing: {
    strong: [
      'Write tests that cover: happy path, edge cases, and error cases.',
      'Use the existing test patterns and frameworks in the project.',
      'Each test should be independent and clearly named.',
      'Mock external dependencies appropriately.',
    ].join(' '),
    weak: [
      'Write tests for the given code.',
      'Include: 1) A test for normal usage, 2) A test for edge cases, 3) A test for errors.',
      'Use simple, clear test names.',
      'Follow the existing test file patterns.',
    ].join(' '),
  },

  code_review: {
    strong: [
      'Review the code for: correctness, performance, security, maintainability.',
      'Provide specific, actionable feedback with line references.',
      'Distinguish between critical issues and suggestions.',
      'Acknowledge what is done well.',
    ].join(' '),
    weak: [
      'Review this code. Look for:',
      '1. Bugs or incorrect logic',
      '2. Security issues',
      '3. Performance problems',
      'Be specific about what to fix and how.',
    ].join(' '),
  },

  planning: {
    strong: [
      'Break down the task into clear, actionable steps.',
      'Consider dependencies between steps.',
      'Identify potential risks or blockers.',
      'Estimate relative complexity of each step.',
    ].join(' '),
    weak: [
      'Create a numbered list of steps to complete this task.',
      'Keep each step small and clear.',
      'List them in the order they should be done.',
    ].join(' '),
  },

  explanation: {
    strong: [
      'Explain the code clearly and concisely.',
      'Cover: purpose, how it works, key design decisions, and any gotchas.',
      'Use examples where helpful.',
    ].join(' '),
    weak: [
      'Explain what this code does in simple terms.',
      'Break it down line by line if needed.',
      'Use plain language.',
    ].join(' '),
  },

  completion: {
    strong: [
      'Complete the code following the established patterns and style.',
      'Ensure type safety and handle edge cases.',
      'Only output the completion, not the existing code.',
    ].join(' '),
    weak: [
      'Complete the code. Follow the same style as the existing code.',
      'Only output the new code that should be added.',
      'Do NOT repeat code that already exists.',
    ].join(' '),
  },
};

// ---------------------------------------------------------------------------
// Output Format Instructions
// ---------------------------------------------------------------------------

const outputFormatInstructions: Record<
  NonNullable<AdaptOptions['outputFormat']>,
  { standard: string; xml: string }
> = {
  freeform: {
    standard: '',
    xml: '',
  },

  json: {
    standard: [
      'Respond with valid JSON only. No markdown code fences around the JSON.',
      'Ensure all strings are properly escaped.',
      'Do not include comments or trailing commas.',
    ].join('\n'),
    xml: [
      '<output_format>',
      'Respond with valid JSON only. No markdown code fences.',
      'Ensure all strings are properly escaped.',
      'Do not include comments or trailing commas.',
      '</output_format>',
    ].join('\n'),
  },

  xml: {
    standard: [
      'Respond with well-formed XML.',
      'Use self-closing tags for empty elements.',
      'Escape special characters in text content.',
    ].join('\n'),
    xml: [
      '<output_format>',
      'Respond with well-formed XML.',
      'Use self-closing tags for empty elements.',
      'Escape special characters in text content.',
      '</output_format>',
    ].join('\n'),
  },

  diff: {
    standard: [
      'Output changes in unified diff format:',
      '```',
      '--- a/path/to/file',
      '+++ b/path/to/file',
      '@@ -line,count +line,count @@',
      ' context line',
      '-removed line',
      '+added line',
      ' context line',
      '```',
      '',
      'Include 3 lines of context around each change.',
      'Only show changed sections, not the entire file.',
    ].join('\n'),
    xml: [
      '<output_format>',
      'Output changes in unified diff format with 3 lines of context.',
      'Use standard --- a/ and +++ b/ headers.',
      'Only show changed sections.',
      '</output_format>',
    ].join('\n'),
  },

  search_replace: {
    standard: [
      'Output changes using SEARCH/REPLACE blocks:',
      '',
      '<<<SEARCH',
      'exact lines from the file',
      '===',
      'replacement lines',
      '>>>',
      '',
      'Rules:',
      '- Include 2-3 lines of unchanged context to uniquely identify the location',
      '- The SEARCH section must match the existing file EXACTLY (including whitespace)',
      '- Only change what is necessary in the REPLACE section',
      '- Use multiple SEARCH/REPLACE blocks for multiple changes',
      '- Order blocks by their position in the file (top to bottom)',
    ].join('\n'),
    xml: [
      '<output_format>',
      'Output changes using SEARCH/REPLACE blocks:',
      '',
      '<<<SEARCH',
      'exact lines from the file',
      '===',
      'replacement lines',
      '>>>',
      '',
      'Rules:',
      '- Include 2-3 lines of context to uniquely identify the location',
      '- SEARCH must match existing file exactly',
      '- Only change what is necessary',
      '- Use multiple blocks for multiple changes',
      '</output_format>',
    ].join('\n'),
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get model-specific instructions for a task type */
export function getTaskInstructions(
  taskType: AdaptOptions['taskType'],
  modelFamily: ModelFamily
): string {
  const instructions = taskInstructions[taskType];
  const isStrong = isStrongModel(modelFamily);
  return isStrong ? instructions.strong : instructions.weak;
}

/** Get the optimal output format instruction for a model */
export function getOutputFormatInstruction(
  format: AdaptOptions['outputFormat'],
  modelFamily: ModelFamily
): string {
  if (!format || format === 'freeform') return '';

  const instructions = outputFormatInstructions[format];
  const strategy = strategies[modelFamily];

  if (strategy.prefersXml) {
    return instructions.xml;
  }
  return instructions.standard;
}

/** Adapt a prompt for optimal performance with the target model */
export function adaptPrompt(options: AdaptOptions): AdaptedPrompt {
  const {
    modelId,
    provider,
    taskType,
    systemPrompt,
    userMessage,
    conversationHistory = [],
    codeContext,
    outputFormat = 'freeform',
  } = options;

  const modelFamily = detectModelFamily(modelId, provider);
  const strategy = strategies[modelFamily];
  const adaptations: string[] = [];

  // --- Build system prompt ---
  let adaptedSystem = strategy.formatSystemPrompt(systemPrompt, taskType);
  adaptations.push(`system_format:${modelFamily}`);

  // Add task-specific instructions
  const taskInstr = getTaskInstructions(taskType, modelFamily);
  if (taskInstr) {
    if (strategy.prefersXml) {
      adaptedSystem += `\n\n<task_instructions>\n${taskInstr}\n</task_instructions>`;
    } else {
      adaptedSystem += `\n\n## Task Instructions\n\n${taskInstr}`;
    }
    adaptations.push(`task_instructions:${taskType}`);
  }

  // Add output format instructions
  const formatInstr = getOutputFormatInstruction(outputFormat, modelFamily);
  if (formatInstr) {
    adaptedSystem += `\n\n${formatInstr}`;
    adaptations.push(`output_format:${outputFormat}`);
  }

  // For models that need explicit constraints, add reminders
  if (strategy.needsExplicitConstraints) {
    const constraints = getConstraintReminders(taskType, modelFamily);
    if (constraints) {
      adaptedSystem += `\n\n${constraints}`;
      adaptations.push('explicit_constraints');
    }
  }

  // Enforce max system length if specified
  if (strategy.maxSystemLength && adaptedSystem.length > strategy.maxSystemLength) {
    adaptedSystem = truncatePrompt(adaptedSystem, strategy.maxSystemLength);
    adaptations.push(`truncated_system:${strategy.maxSystemLength}`);
  }

  // --- Build user message ---
  const adaptedUser = strategy.formatUserMessage(userMessage, codeContext);
  if (codeContext) {
    adaptations.push('code_context_included');
  }

  // --- Build messages array ---
  const messages: { role: PromptRole; content: string }[] = [];

  // Add conversation history
  if (conversationHistory.length > 0) {
    const maxHistory = strategy.supportsLongContext ? conversationHistory.length : Math.min(conversationHistory.length, 10);
    const historySlice = conversationHistory.slice(-maxHistory);
    for (const msg of historySlice) {
      messages.push({ role: msg.role, content: msg.content });
    }
    if (historySlice.length < conversationHistory.length) {
      adaptations.push(`history_truncated:${historySlice.length}/${conversationHistory.length}`);
    }
  }

  // Add the adapted user message
  messages.push({ role: 'user', content: adaptedUser });

  // For llama models, repeat key constraints at the end
  if (modelFamily === 'llama' && outputFormat !== 'freeform') {
    const reminder = getFormatReminder(outputFormat, modelFamily);
    if (reminder) {
      // Append reminder to the last user message
      messages[messages.length - 1].content += `\n\nREMINDER: ${reminder}`;
      adaptations.push('format_reminder_appended');
    }
  }

  // For anthropic-claude, add thinking encouragement for complex tasks
  if (modelFamily === 'anthropic-claude') {
    const complexTasks: AdaptOptions['taskType'][] = [
      'bug_fix', 'refactoring', 'code_review',
    ];
    if (complexTasks.includes(taskType)) {
      adaptedSystem += '\n\nBefore providing your answer, think through the problem carefully.';
      adaptations.push('thinking_encouraged');
    }
  }

  return {
    messages,
    systemPrompt: adaptedSystem,
    modelFamily,
    adaptations,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Determine if a model family is "strong" (capable of complex reasoning) */
function isStrongModel(family: ModelFamily): boolean {
  switch (family) {
    case 'openai-gpt4':
    case 'anthropic-claude':
    case 'deepseek':
    case 'qwen':
      return true;
    case 'openai-mini':
    case 'llama':
    case 'mistral':
    case 'phi':
    case 'gemma':
    case 'generic':
      return false;
  }
}

/** Truncate a prompt to a maximum character length, preserving sentence boundaries */
function truncatePrompt(prompt: string, maxLength: number): string {
  if (prompt.length <= maxLength) return prompt;

  // Try to cut at a sentence boundary
  const truncated = prompt.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);

  if (cutPoint > maxLength * 0.7) {
    return truncated.slice(0, cutPoint + 1);
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}

/** Get constraint reminders for weaker models */
function getConstraintReminders(
  taskType: AdaptOptions['taskType'],
  _modelFamily: ModelFamily
): string {
  switch (taskType) {
    case 'code_generation':
      return [
        '## Important Reminders',
        '- Output ONLY the requested code',
        '- Do NOT include usage examples unless asked',
        '- Do NOT explain the code unless asked',
        '- Follow the exact function signature if one is provided',
      ].join('\n');

    case 'bug_fix':
      return [
        '## Important Reminders',
        '- Fix ONLY the bug described',
        '- Do NOT refactor other code',
        '- Do NOT add new features',
        '- Keep changes minimal',
      ].join('\n');

    case 'refactoring':
      return [
        '## Important Reminders',
        '- Do NOT change behavior',
        '- Do NOT fix bugs during refactoring',
        '- Keep the same public interface',
        '- Test mentally that inputs produce the same outputs',
      ].join('\n');

    case 'test_writing':
      return [
        '## Important Reminders',
        '- Use the same test framework as existing tests',
        '- Each test should test ONE thing',
        '- Use descriptive test names',
      ].join('\n');

    case 'completion':
      return [
        '## Important Reminders',
        '- Only output the NEW code to add',
        '- Do NOT repeat existing code',
        '- Match the style of surrounding code',
      ].join('\n');

    default:
      return '';
  }
}

/** Get a brief format reminder for appending to user messages (for weaker models) */
function getFormatReminder(
  format: NonNullable<AdaptOptions['outputFormat']>,
  _modelFamily: ModelFamily
): string {
  switch (format) {
    case 'json':
      return 'Output valid JSON only. No markdown fences.';
    case 'xml':
      return 'Output well-formed XML only.';
    case 'diff':
      return 'Output unified diff format only.';
    case 'search_replace':
      return 'Use <<<SEARCH ... === ... >>> blocks for all changes.';
    default:
      return '';
  }
}
