/**
 * AST Validation — validates generated code is syntactically correct.
 * Uses regex-based heuristic parsing (no tree-sitter dependency).
 * This is the FIRST and FASTEST validation step (no external tools needed).
 */

export type ASTValidationResult = {
  valid: boolean;
  errors: ASTError[];
  warnings: ASTWarning[];
  language: string;
};

export type ASTError = {
  line: number;
  column?: number;
  message: string;
  severity: 'error';
  fixHint?: string;
};

export type ASTWarning = {
  line: number;
  message: string;
  severity: 'warning';
};

// --- Language Detection ---

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.rb': 'ruby',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

/** Detect the language of a code snippet */
export function detectLanguage(code: string, filePath?: string): string {
  // From file extension
  if (filePath) {
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    if (ext && EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  // From content heuristics
  if (/import\s+React|from\s+['"]react['"]|<[A-Z][a-zA-Z]*[\s/>]/.test(code)) {
    return 'tsx';
  }
  if (/^#!\s*\/usr\/bin\/env\s+(python|python3)/m.test(code)) {
    return 'python';
  }
  if (/^\s*def\s+\w+\s*\(|^\s*class\s+\w+.*:/m.test(code)) {
    return 'python';
  }
  if (/^\s*fn\s+\w+/m.test(code) && /->/.test(code) && /let\s+mut\s/.test(code)) {
    return 'rust';
  }
  if (/^\s*fn\s+\w+/m.test(code) && /(impl|struct|enum|trait|pub\s)/.test(code)) {
    return 'rust';
  }
  if (/^\s*func\s+\w+/m.test(code) && /package\s+\w+/.test(code)) {
    return 'go';
  }
  if (/^\s*func\s+\w+/m.test(code)) {
    return 'go';
  }
  if (/^\s*import\s+\{.*\}\s+from\s+['"]|:\s*(string|number|boolean|any)\b|interface\s+\w+\s*\{/.test(code)) {
    return 'typescript';
  }
  if (/^\s*(const|let|var)\s+\w+\s*=|function\s+\w+\s*\(|=>\s*\{/m.test(code)) {
    return 'javascript';
  }

  return 'typescript';
}

// --- Bracket Balance Checking ---

type BracketEntry = {
  char: string;
  line: number;
  column: number;
};

const OPEN_BRACKETS = new Set(['{', '(', '[']);
const CLOSE_BRACKETS = new Set(['}', ')', ']']);
const BRACKET_PAIRS: Record<string, string> = {
  '}': '{',
  ')': '(',
  ']': '[',
};
const BRACKET_NAMES: Record<string, string> = {
  '{': 'brace',
  '}': 'brace',
  '(': 'parenthesis',
  ')': 'parenthesis',
  '[': 'bracket',
  ']': 'bracket',
};

/** Check bracket/brace/paren balance */
export function checkBracketBalance(code: string): ASTError[] {
  const errors: ASTError[] = [];
  const stack: BracketEntry[] = [];
  const lines = code.split('\n');

  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let inString: string | null = null; // The quote character
  let inTemplateLiteral = false;
  let templateDepth = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    inSingleLineComment = false;

    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      const next = col < line.length - 1 ? line[col + 1] : '';

      // Handle escape sequences in strings
      if (inString && ch === '\\') {
        col++; // Skip next character
        continue;
      }

      // Handle multi-line comment end
      if (inMultiLineComment) {
        if (ch === '*' && next === '/') {
          inMultiLineComment = false;
          col++; // Skip '/'
        }
        continue;
      }

      // Handle single-line comment
      if (inSingleLineComment) {
        continue;
      }

      // Handle string end
      if (inString) {
        if (ch === inString) {
          inString = null;
        }
        continue;
      }

      // Handle template literal
      if (inTemplateLiteral && templateDepth === 0) {
        if (ch === '\\') {
          col++;
          continue;
        }
        if (ch === '`') {
          inTemplateLiteral = false;
          continue;
        }
        if (ch === '$' && next === '{') {
          templateDepth++;
          col++;
          stack.push({ char: '{', line: lineIdx + 1, column: col + 1 });
          continue;
        }
        continue;
      }

      // Detect comment starts
      if (ch === '/' && next === '/') {
        inSingleLineComment = true;
        continue;
      }
      if (ch === '/' && next === '*') {
        inMultiLineComment = true;
        col++;
        continue;
      }
      // Python single-line comment
      if (ch === '#' && !inString) {
        inSingleLineComment = true;
        continue;
      }

      // Detect string starts
      if (ch === '"' || ch === "'") {
        inString = ch;
        continue;
      }
      if (ch === '`') {
        inTemplateLiteral = true;
        continue;
      }

      // Handle template literal expression end
      if (templateDepth > 0 && ch === '}') {
        if (stack.length > 0 && stack[stack.length - 1].char === '{') {
          stack.pop();
          templateDepth--;
          if (templateDepth === 0) {
            // Back in template literal
          }
          continue;
        }
      }

      // Bracket handling
      if (OPEN_BRACKETS.has(ch)) {
        stack.push({ char: ch, line: lineIdx + 1, column: col + 1 });
      } else if (CLOSE_BRACKETS.has(ch)) {
        const expected = BRACKET_PAIRS[ch];
        if (stack.length === 0) {
          errors.push({
            line: lineIdx + 1,
            column: col + 1,
            message: `Unmatched closing ${BRACKET_NAMES[ch]} '${ch}'`,
            severity: 'error',
            fixHint: `Remove the extra '${ch}' or add a matching opening '${expected}'`,
          });
        } else if (stack[stack.length - 1].char !== expected) {
          const top = stack[stack.length - 1];
          errors.push({
            line: lineIdx + 1,
            column: col + 1,
            message: `Mismatched bracket: expected closing for '${top.char}' (opened at line ${top.line}) but found '${ch}'`,
            severity: 'error',
            fixHint: `Check bracket pairing between line ${top.line} and line ${lineIdx + 1}`,
          });
          stack.pop();
        } else {
          stack.pop();
        }
      }
    }
  }

  // Report unclosed brackets
  for (const entry of stack) {
    const closingChar = entry.char === '{' ? '}' : entry.char === '(' ? ')' : ']';
    errors.push({
      line: entry.line,
      column: entry.column,
      message: `Unmatched opening ${BRACKET_NAMES[entry.char]} '${entry.char}'`,
      severity: 'error',
      fixHint: `Add closing '${closingChar}' after the corresponding block`,
    });
  }

  return errors;
}

// --- Common Error Detection ---

/** Check for common syntax errors */
export function checkCommonErrors(code: string, language: string): ASTError[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return checkTSJSErrors(code, language);
    case 'python':
      return checkPythonErrors(code);
    default:
      return [];
  }
}

function checkTSJSErrors(code: string, language: string): ASTError[] {
  const errors: ASTError[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed === '') {
      continue;
    }

    // const without assignment
    if (/^\s*(export\s+)?(const)\s+\w+\s*;?\s*$/.test(line) && !trimmed.includes('=')) {
      errors.push({
        line: lineNum,
        message: "'const' declaration must be initialized with a value",
        severity: 'error',
        fixHint: "Add '= <value>' after the variable name",
      });
    }

    // Unclosed string literal (basic check — single line)
    const strCheck = trimmed.replace(/\\['"`]/g, ''); // Remove escaped quotes
    for (const quote of ["'", '"']) {
      const count = (strCheck.match(new RegExp(`(?<!\\\\)${quote === "'" ? "'" : '"'}`, 'g')) || []).length;
      if (count % 2 !== 0 && !trimmed.endsWith(',') && !trimmed.includes('`')) {
        // Heuristic: odd number of quotes likely means unclosed
        // But skip template literals and multi-line scenarios
        if (!trimmed.includes('${') && !trimmed.endsWith('\\')) {
          errors.push({
            line: lineNum,
            message: `Possible unclosed string literal (unmatched ${quote === "'" ? 'single' : 'double'} quote)`,
            severity: 'error',
            fixHint: `Add closing ${quote} at the end of the string`,
          });
        }
      }
    }

    // Duplicate else without if
    if (/^\s*else\s+else\b/.test(line)) {
      errors.push({
        line: lineNum,
        message: "Duplicate 'else' without 'if'",
        severity: 'error',
        fixHint: "Remove the duplicate 'else' or add an 'if' condition",
      });
    }

    // Arrow function without body or expression
    if (/=>\s*$/.test(trimmed) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine === '' || /^[)};\]]/.test(nextLine)) {
        errors.push({
          line: lineNum,
          message: 'Arrow function has no body or expression',
          severity: 'error',
          fixHint: 'Add a function body {} or an expression after =>',
        });
      }
    }

    // Basic JSX tag mismatch (only for tsx/jsx)
    if (language === 'tsx' || language === 'jsx') {
      checkJSXTags(trimmed, lineNum, errors);
    }
  }

  return errors;
}

function checkJSXTags(line: string, lineNum: number, errors: ASTError[]): void {
  // Very basic: check for opening and closing tags on the same line that don't match
  const openMatch = line.match(/<([A-Z][a-zA-Z0-9.]*)[^>]*(?<!\/)\s*>/);
  const closeMatch = line.match(/<\/([A-Z][a-zA-Z0-9.]*)>/);

  if (openMatch && closeMatch && openMatch[1] !== closeMatch[1]) {
    // Only flag if both are on the same line and clearly mismatched
    const openCount = (line.match(new RegExp(`<${openMatch[1]}[\\s>]`, 'g')) || []).length;
    const closeCount = (line.match(new RegExp(`</${openMatch[1]}>`, 'g')) || []).length;
    if (openCount > closeCount) {
      errors.push({
        line: lineNum,
        message: `Possible mismatched JSX tags: opening <${openMatch[1]}> but closing </${closeMatch[1]}>`,
        severity: 'error',
        fixHint: `Change </${closeMatch[1]}> to </${openMatch[1]}> or fix the opening tag`,
      });
    }
  }
}

function checkPythonErrors(code: string): ASTError[] {
  const errors: ASTError[] = [];
  const lines = code.split('\n');

  let indentUnit: number | null = null; // Detected indentation unit (spaces)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    // Check indentation
    const indentMatch = line.match(/^( +)/);
    const currentIndent = indentMatch ? indentMatch[1].length : 0;

    // Detect mixed tabs and spaces
    if (/^\t+ /.test(line) || /^ +\t/.test(line)) {
      errors.push({
        line: lineNum,
        message: 'Mixed tabs and spaces in indentation',
        severity: 'error',
        fixHint: 'Use consistent indentation (spaces recommended)',
      });
    }

    // Detect indentation unit
    if (currentIndent > 0 && indentUnit === null) {
      indentUnit = currentIndent;
    }

    // Check for inconsistent indentation
    if (indentUnit && currentIndent > 0 && currentIndent % indentUnit !== 0) {
      errors.push({
        line: lineNum,
        message: `Inconsistent indentation: expected multiple of ${indentUnit} spaces, got ${currentIndent}`,
        severity: 'error',
        fixHint: `Adjust indentation to ${Math.round(currentIndent / indentUnit) * indentUnit} spaces`,
      });
    }

    // Missing colon after def/class/if/for/while/elif/else/try/except/finally/with
    const blockKeywords = /^\s*(def|class|if|elif|else|for|while|try|except|finally|with|async\s+def|async\s+for|async\s+with)\b/;
    const blockMatch = line.match(blockKeywords);
    if (blockMatch) {
      const trimmed = line.trim();
      // Should end with colon (possibly after comment)
      const withoutComment = trimmed.replace(/#.*$/, '').trim();
      if (!withoutComment.endsWith(':') && !withoutComment.endsWith(':\\') && !withoutComment.endsWith(',')) {
        // Check if it's a multi-line statement (ends with \)
        if (!withoutComment.endsWith('\\') && !withoutComment.endsWith('(')) {
          errors.push({
            line: lineNum,
            message: `Missing colon after '${blockMatch[1]}' statement`,
            severity: 'error',
            fixHint: "Add ':' at the end of the line",
          });
        }
      }
    }

  }

  return errors;
}

// --- Main Validation Function ---

/** Validate code syntax using heuristic checks */
export function validateSyntax(code: string, language?: string): ASTValidationResult {
  const detectedLanguage = language || detectLanguage(code);
  const bracketErrors = checkBracketBalance(code);
  const commonErrors = checkCommonErrors(code, detectedLanguage);

  const allErrors = [...bracketErrors, ...commonErrors];

  // Deduplicate errors on the same line with the same message
  const seen = new Set<string>();
  const dedupedErrors: ASTError[] = [];
  for (const err of allErrors) {
    const key = `${err.line}:${err.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedErrors.push(err);
    }
  }

  // Sort by line number
  dedupedErrors.sort((a, b) => a.line - b.line);

  return {
    valid: dedupedErrors.length === 0,
    errors: dedupedErrors,
    warnings: [],
    language: detectedLanguage,
  };
}

// --- Format for AI Feedback ---

/** Format validation errors for feeding back to the AI */
export function formatErrorsForAI(result: ASTValidationResult, _code: string): string {
  if (result.valid) {
    return '';
  }

  const lines: string[] = ['SYNTAX ERRORS in your code:'];
  lines.push('');

  for (const error of result.errors) {
    let msg = `Line ${error.line}: ${error.message}`;
    if (error.fixHint) {
      msg += ` (hint: ${error.fixHint})`;
    }
    lines.push(msg);
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS:');
    for (const warning of result.warnings) {
      lines.push(`Line ${warning.line}: ${warning.message}`);
    }
  }

  lines.push('');
  lines.push('Please fix these syntax errors and return the corrected code.');

  return lines.join('\n');
}
