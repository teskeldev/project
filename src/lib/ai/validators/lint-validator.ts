/**
 * Lint & Type Check Feedback Loop — runs external tools and feeds errors back.
 * Executes ESLint, TypeScript compiler, or other linters on generated code
 * and formats the output for AI self-correction.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { validateSyntax, type ASTValidationResult } from './ast-validator';

const execAsync = promisify(exec);

export type LintResult = {
  success: boolean;
  errors: LintError[];
  warnings: LintWarning[];
  raw: string;
  tool: string;
};

export type LintError = {
  file: string;
  line: number;
  column: number;
  message: string;
  rule?: string;
  severity: 'error';
  fixable: boolean;
};

export type LintWarning = {
  file: string;
  line: number;
  column: number;
  message: string;
  rule?: string;
  severity: 'warning';
};

export type TypeCheckResult = {
  success: boolean;
  errors: TypeCheckError[];
  raw: string;
};

export type TypeCheckError = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
};

export type ValidationPipelineResult = {
  passed: boolean;
  astResult?: ASTValidationResult;
  lintResult?: LintResult;
  typeCheckResult?: TypeCheckResult;
  allErrors: string[];
  feedbackForAI: string;
};

// --- Temp File Utilities ---

async function createTempFile(
  code: string,
  extension: string
): Promise<{ filePath: string; dirPath: string }> {
  const dirPath = await mkdtemp(join(tmpdir(), 'teskel-validate-'));
  const filePath = join(dirPath, `validate${extension}`);
  await writeFile(filePath, code, 'utf-8');
  return { filePath, dirPath };
}

async function cleanupTempFile(filePath: string, dirPath: string): Promise<void> {
  try {
    await unlink(filePath);
    // Remove the temp directory (it should be empty now)
    const { rmdir } = await import('fs/promises');
    await rmdir(dirPath);
  } catch {
    // Best-effort cleanup — don't throw
  }
}

// --- ESLint ---

function parseESLintJSON(raw: string, filePath: string): { errors: LintError[]; warnings: LintWarning[] } {
  const errors: LintError[] = [];
  const warnings: LintWarning[] = [];

  try {
    const results = JSON.parse(raw);
    if (!Array.isArray(results)) return { errors, warnings };

    for (const fileResult of results) {
      const messages = fileResult.messages || [];
      for (const msg of messages) {
        const entry = {
          file: filePath,
          line: msg.line || 1,
          column: msg.column || 1,
          message: msg.message || 'Unknown error',
          rule: msg.ruleId || undefined,
          fixable: !!msg.fix,
        };

        if (msg.severity === 2) {
          errors.push({ ...entry, severity: 'error' });
        } else {
          warnings.push({ ...entry, severity: 'warning' });
        }
      }
    }
  } catch {
    // If JSON parsing fails, try line-by-line parsing
    const linePattern = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(.+)$/;
    for (const line of raw.split('\n')) {
      const match = line.match(linePattern);
      if (match) {
        const entry = {
          file: filePath,
          line: parseInt(match[1], 10),
          column: parseInt(match[2], 10),
          message: match[4],
          rule: match[5],
          fixable: false,
        };
        if (match[3] === 'error') {
          errors.push({ ...entry, severity: 'error' });
        } else {
          warnings.push({ ...entry, severity: 'warning' });
        }
      }
    }
  }

  return { errors, warnings };
}

/** Run ESLint on a code string */
export async function runLint(
  code: string,
  options?: { language?: string; config?: string; cwd?: string }
): Promise<LintResult> {
  const language = options?.language || 'typescript';
  const extension = language === 'tsx' || language === 'jsx'
    ? `.${language}`
    : language === 'javascript' ? '.js' : '.ts';

  const { filePath, dirPath } = await createTempFile(code, extension);

  try {
    const configFlag = options?.config ? `--config ${options.config}` : '--no-eslintrc';
    const cwd = options?.cwd || process.cwd();

    const cmd = `npx eslint --format json ${configFlag} "${filePath}"`;

    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      timeout: 10_000,
      env: { ...process.env, NODE_ENV: 'production' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).catch((error: any) => {
      // ESLint exits with code 1 when it finds errors — that's expected
      if (error.stdout) {
        return { stdout: error.stdout as string, stderr: (error.stderr || '') as string };
      }
      throw error;
    });

    const raw = stdout || stderr || '';
    const { errors, warnings } = parseESLintJSON(raw, filePath);

    return {
      success: errors.length === 0,
      errors,
      warnings,
      raw,
      tool: 'eslint',
    };
     
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // Graceful degradation: if ESLint is not available, return success
    const message = error?.message || String(error);
    if (
      message.includes('ENOENT') ||
      message.includes('not found') ||
      message.includes('Cannot find module') ||
      message.includes('ETIMEDOUT') ||
      message.includes('timed out')
    ) {
      return {
        success: true,
        errors: [],
        warnings: [],
        raw: `ESLint not available: ${message}`,
        tool: 'eslint',
      };
    }

    return {
      success: true,
      errors: [],
      warnings: [],
      raw: `ESLint execution failed: ${message}`,
      tool: 'eslint',
    };
  } finally {
    await cleanupTempFile(filePath, dirPath);
  }
}

// --- TypeScript Type Checking ---

function parseTSCOutput(raw: string, filePath: string): TypeCheckError[] {
  const errors: TypeCheckError[] = [];

  // TSC output format: file(line,col): error TSxxxx: message
  const pattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    errors.push({
      file: match[1] === filePath ? filePath : match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim(),
    });
  }

  // Also try the alternative format: file:line:col - error TSxxxx: message
  if (errors.length === 0) {
    const altPattern = /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/gm;
    while ((match = altPattern.exec(raw)) !== null) {
      errors.push({
        file: match[1] === filePath ? filePath : match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: match[5].trim(),
      });
    }
  }

  return errors;
}

/** Run TypeScript type checking on a code string */
export async function runTypeCheck(
  code: string,
  options?: { tsconfig?: string; cwd?: string }
): Promise<TypeCheckResult> {
  const { filePath, dirPath } = await createTempFile(code, '.ts');

  try {
    const cwd = options?.cwd || process.cwd();
    const tsconfigFlag = options?.tsconfig ? `--project ${options.tsconfig}` : '--strict';

    const cmd = `npx tsc --noEmit ${tsconfigFlag} "${filePath}"`;

    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      timeout: 15_000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).catch((error: any) => {
      // tsc exits with non-zero when it finds errors
      if (error.stdout || error.stderr) {
        return { stdout: (error.stdout || '') as string, stderr: (error.stderr || '') as string };
      }
      throw error;
    });

    const raw = `${stdout}\n${stderr}`.trim();
    const errors = parseTSCOutput(raw, filePath);

    return {
      success: errors.length === 0,
      errors,
      raw,
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // Graceful degradation: if tsc is not available, return success
    const message = error?.message || String(error);
    if (
      message.includes('ENOENT') ||
      message.includes('not found') ||
      message.includes('Cannot find module') ||
      message.includes('ETIMEDOUT') ||
      message.includes('timed out')
    ) {
      return {
        success: true,
        errors: [],
        raw: `TypeScript compiler not available: ${message}`,
      };
    }

    return {
      success: true,
      errors: [],
      raw: `TypeScript check failed: ${message}`,
    };
  } finally {
    await cleanupTempFile(filePath, dirPath);
  }
}

// --- Validation Pipeline ---

/** Run the full validation pipeline (AST → Lint → TypeCheck) */
export async function runValidationPipeline(
  code: string,
  options?: {
    language?: string;
    skipLint?: boolean;
    skipTypeCheck?: boolean;
    cwd?: string;
    filePath?: string;
  }
): Promise<ValidationPipelineResult> {
  const allErrors: string[] = [];

  // Step 1: AST validation (instant, always runs)
  const astResult = validateSyntax(code, options?.language);

  if (!astResult.valid) {
    // Short-circuit: if AST fails, don't bother with lint/typecheck
    for (const err of astResult.errors) {
      allErrors.push(`[Syntax] Line ${err.line}: ${err.message}`);
    }

    const result: ValidationPipelineResult = {
      passed: false,
      astResult,
      allErrors,
      feedbackForAI: '',
    };
    result.feedbackForAI = formatValidationFeedback(result);
    return result;
  }

  // Step 2: Lint (if AST passes and not skipped)
  let lintResult: LintResult | undefined;
  if (!options?.skipLint) {
    const isJSLike = ['typescript', 'javascript', 'tsx', 'jsx'].includes(
      astResult.language
    );
    if (isJSLike) {
      lintResult = await runLint(code, {
        language: astResult.language,
        cwd: options?.cwd,
      });

      for (const err of lintResult.errors) {
        allErrors.push(`[Lint] Line ${err.line}: ${err.message}${err.rule ? ` (${err.rule})` : ''}`);
      }
    }
  }

  // Step 3: Type check (if lint passes and not skipped)
  let typeCheckResult: TypeCheckResult | undefined;
  if (!options?.skipTypeCheck) {
    const isTS = ['typescript', 'tsx'].includes(astResult.language);
    if (isTS && (!lintResult || lintResult.success)) {
      typeCheckResult = await runTypeCheck(code, {
        tsconfig: undefined,
        cwd: options?.cwd,
      });

      for (const err of typeCheckResult.errors) {
        allErrors.push(`[Type] Line ${err.line}: ${err.message} (${err.code})`);
      }
    }
  }

  const passed =
    astResult.valid &&
    (!lintResult || lintResult.success) &&
    (!typeCheckResult || typeCheckResult.success);

  const result: ValidationPipelineResult = {
    passed,
    astResult,
    lintResult,
    typeCheckResult,
    allErrors,
    feedbackForAI: '',
  };
  result.feedbackForAI = formatValidationFeedback(result);
  return result;
}

// --- Format Feedback for AI ---

/** Format validation results as AI-friendly feedback */
export function formatValidationFeedback(result: ValidationPipelineResult): string {
  if (result.passed) {
    return '';
  }

  const sections: string[] = ['YOUR CODE HAS THE FOLLOWING ISSUES:', ''];

  // Syntax errors
  if (result.astResult && !result.astResult.valid) {
    sections.push('## Syntax Errors (must fix):');
    for (const err of result.astResult.errors) {
      let msg = `- Line ${err.line}: ${err.message}`;
      if (err.fixHint) {
        msg += ` (hint: ${err.fixHint})`;
      }
      sections.push(msg);
    }
    sections.push('');
  }

  // Lint errors
  if (result.lintResult && !result.lintResult.success) {
    sections.push('## Lint Errors:');
    for (const err of result.lintResult.errors) {
      let msg = `- Line ${err.line}: ${err.message}`;
      if (err.rule) {
        msg += ` (${err.rule})`;
      }
      sections.push(msg);
    }
    if (result.lintResult.warnings.length > 0) {
      sections.push('');
      sections.push('## Lint Warnings:');
      for (const warn of result.lintResult.warnings) {
        let msg = `- Line ${warn.line}: ${warn.message}`;
        if (warn.rule) {
          msg += ` (${warn.rule})`;
        }
        sections.push(msg);
      }
    }
    sections.push('');
  }

  // Type errors
  if (result.typeCheckResult && !result.typeCheckResult.success) {
    sections.push('## Type Errors:');
    for (const err of result.typeCheckResult.errors) {
      sections.push(`- Line ${err.line}: ${err.message} (${err.code})`);
    }
    sections.push('');
  }

  sections.push('Please fix ALL errors above and return the corrected code.');
  sections.push('Do NOT change any code that doesn\'t have errors.');

  return sections.join('\n');
}
