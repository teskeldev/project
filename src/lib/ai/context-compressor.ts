/**
 * Context Compression — Phase 1.7
 *
 * Reduces file content to fit within token budgets while preserving the most
 * important information. Uses regex-based parsing to extract structural elements
 * (functions, classes, types) and produces compressed representations at various
 * fidelity levels.
 *
 * No external dependencies — pure TypeScript with regex-based parsing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompressionLevel = "full" | "skeleton" | "signatures" | "summary";

export type CompressionOptions = {
  /** Compression fidelity level. Default: 'skeleton' */
  level?: CompressionLevel;
  /** Maximum characters for this file's compressed content */
  maxChars?: number;
  /** Line numbers that are most relevant (show full context around these) */
  relevantLines?: number[];
  /** Function/class names to preserve in full */
  relevantSymbols?: string[];
  /** File language for smart parsing (auto-detected from extension if omitted) */
  language?: string;
  /** Include import statements. Default: true */
  includeImports?: boolean;
  /** Include comments. Default: false for skeleton+ */
  includeComments?: boolean;
  /** Lines of context around relevant sections. Default: 3 */
  contextLines?: number;
};

export type CompressedFile = {
  /** The compressed content */
  content: string;
  /** Original line count */
  originalLines: number;
  /** Compressed line count */
  compressedLines: number;
  /** 0–1 ratio (0 = fully compressed, 1 = no compression) */
  compressionRatio: number;
  /** Sections of the original file that were preserved in full */
  preservedSections: { startLine: number; endLine: number }[];
};

// ---------------------------------------------------------------------------
// Language Detection
// ---------------------------------------------------------------------------

type Language = "typescript" | "python" | "go" | "rust" | "unknown";

const EXTENSION_MAP: Record<string, Language> = {
  ts: "typescript",
  tsx: "typescript",
  js: "typescript",
  jsx: "typescript",
  mjs: "typescript",
  cjs: "typescript",
  py: "python",
  pyw: "python",
  go: "go",
  rs: "rust",
};

/** Detect language from file path extension */
function detectLanguage(filePath: string): Language {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "unknown";
}

// ---------------------------------------------------------------------------
// Regex Patterns by Language
// ---------------------------------------------------------------------------

type LanguagePatterns = {
  importLine: RegExp;
  exportLine: RegExp;
  functionDecl: RegExp;
  classDecl: RegExp;
  typeDecl: RegExp;
  constDecl: RegExp;
  commentBlock: RegExp;
  docComment: RegExp;
};

const TS_PATTERNS: LanguagePatterns = {
  importLine: /^\s*(import\s+.+|require\s*\(.+\))/,
  exportLine: /^\s*export\s+/,
  functionDecl:
    /^\s*(export\s+)?(async\s+)?function\*?\s+\w+|^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(|^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function/,
  classDecl: /^\s*(export\s+)?(abstract\s+)?class\s+\w+/,
  typeDecl:
    /^\s*(export\s+)?(type|interface|enum)\s+\w+/,
  constDecl:
    /^\s*(export\s+)?(const|let|var)\s+\w+/,
  commentBlock: /^\s*(\/\/|\/\*|\*\/|\*)/,
  docComment: /^\s*(\/\*\*|\s*\*\s|^\s*\*\/)/,
};

const PY_PATTERNS: LanguagePatterns = {
  importLine: /^\s*(import\s+|from\s+\S+\s+import\s+)/,
  exportLine: /^\s*__all__\s*=/,
  functionDecl: /^\s*(async\s+)?def\s+\w+/,
  classDecl: /^\s*class\s+\w+/,
  typeDecl: /^\s*(\w+)\s*:\s*TypeAlias|^\s*class\s+\w+\(.*Protocol.*\)/,
  constDecl: /^[A-Z_][A-Z_0-9]*\s*[=:]/,
  commentBlock: /^\s*#/,
  docComment: /^\s*("""|''')/,
};

const GO_PATTERNS: LanguagePatterns = {
  importLine: /^\s*import\s+/,
  exportLine: /^\s*func\s+[A-Z]|^\s*type\s+[A-Z]|^\s*var\s+[A-Z]/,
  functionDecl: /^\s*func\s+/,
  classDecl: /^\s*type\s+\w+\s+struct/,
  typeDecl: /^\s*type\s+\w+\s+(interface|struct)/,
  constDecl: /^\s*(const|var)\s+/,
  commentBlock: /^\s*\/\//,
  docComment: /^\s*\/\//,
};

const RUST_PATTERNS: LanguagePatterns = {
  importLine: /^\s*use\s+/,
  exportLine: /^\s*pub\s+/,
  functionDecl: /^\s*(pub\s+)?(async\s+)?fn\s+\w+/,
  classDecl: /^\s*(pub\s+)?struct\s+\w+/,
  typeDecl: /^\s*(pub\s+)?(trait|enum|struct|type)\s+\w+/,
  constDecl: /^\s*(pub\s+)?(const|static)\s+/,
  commentBlock: /^\s*\/\//,
  docComment: /^\s*\/\/[\/!]/,
};

function getPatternsForLanguage(lang: Language): LanguagePatterns {
  switch (lang) {
    case "typescript":
      return TS_PATTERNS;
    case "python":
      return PY_PATTERNS;
    case "go":
      return GO_PATTERNS;
    case "rust":
      return RUST_PATTERNS;
    default:
      return TS_PATTERNS; // Fallback to TS patterns as a reasonable default
  }
}

// ---------------------------------------------------------------------------
// Structural Extraction
// ---------------------------------------------------------------------------

type StructuralElement = {
  type: "import" | "export" | "function" | "class" | "type" | "const" | "comment" | "other";
  startLine: number;
  endLine: number;
  signature: string;
  name: string;
  isDocComment: boolean;
};

/**
 * Extract structural elements from source code using regex-based parsing.
 * Identifies functions, classes, types, imports, and constants.
 */
function extractStructure(
  lines: string[],
  lang: Language
): StructuralElement[] {
  const patterns = getPatternsForLanguage(lang);
  const elements: StructuralElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Import statements
    if (patterns.importLine.test(line)) {
      const startLine = i;
      let endLine = i;
      // Handle multi-line imports
      if (lang === "go" && line.trim() === "import (") {
        while (endLine < lines.length - 1 && !lines[endLine].includes(")")) {
          endLine++;
        }
      } else if (line.includes("{") && !line.includes("}")) {
        while (endLine < lines.length - 1 && !lines[endLine].includes("}")) {
          endLine++;
        }
      }
      elements.push({
        type: "import",
        startLine,
        endLine,
        signature: lines.slice(startLine, endLine + 1).join("\n"),
        name: "",
        isDocComment: false,
      });
      i = endLine + 1;
      continue;
    }

    // Class declarations
    if (patterns.classDecl.test(line)) {
      const startLine = i;
      const endLine = findBlockEnd(lines, i, lang);
      const name = extractName(line, lang, "class");
      elements.push({
        type: "class",
        startLine,
        endLine,
        signature: line.trimEnd(),
        name,
        isDocComment: false,
      });
      i = endLine + 1;
      continue;
    }

    // Type/interface declarations
    if (patterns.typeDecl.test(line)) {
      const startLine = i;
      const endLine = findBlockEnd(lines, i, lang);
      const name = extractName(line, lang, "type");
      elements.push({
        type: "type",
        startLine,
        endLine,
        signature: lines.slice(startLine, endLine + 1).join("\n"),
        name,
        isDocComment: false,
      });
      i = endLine + 1;
      continue;
    }

    // Function declarations
    if (patterns.functionDecl.test(line)) {
      const startLine = i;
      const endLine = findBlockEnd(lines, i, lang);
      const name = extractName(line, lang, "function");
      const sig = extractFunctionSignature(lines, startLine, lang);
      elements.push({
        type: "function",
        startLine,
        endLine,
        signature: sig,
        name,
        isDocComment: false,
      });
      i = endLine + 1;
      continue;
    }

    // Const/var declarations (top-level only — skip indented lines in function bodies)
    if (patterns.constDecl.test(line) && !patterns.functionDecl.test(line) && /^\S|^export/.test(line)) {
      const startLine = i;
      const endLine = findStatementEnd(lines, i, lang);
      const name = extractName(line, lang, "const");
      elements.push({
        type: "const",
        startLine,
        endLine,
        signature: truncateValue(line.trimEnd()),
        name,
        isDocComment: false,
      });
      i = endLine + 1;
      continue;
    }

    // Doc comments (JSDoc, Python docstrings, Rust doc comments)
    if (patterns.docComment.test(line)) {
      const startLine = i;
      let endLine = i;
      if (lang === "typescript" && line.trim().startsWith("/**")) {
        while (endLine < lines.length - 1 && !lines[endLine].includes("*/")) {
          endLine++;
        }
      } else if (lang === "python" && /^\s*("""|''')/.test(line)) {
        if (!line.trim().endsWith('"""') || line.trim() === '"""') {
          endLine++;
          while (endLine < lines.length - 1 && !/^\s*("""|''')/.test(lines[endLine]) && !lines[endLine].includes('"""')) {
            endLine++;
          }
        }
      }
      elements.push({
        type: "comment",
        startLine,
        endLine,
        signature: lines.slice(startLine, endLine + 1).join("\n"),
        name: "",
        isDocComment: true,
      });
      i = endLine + 1;
      continue;
    }

    i++;
  }

  return elements;
}

/** Extract a name from a declaration line */
function extractName(line: string, _lang: Language, type: string): string {
  const trimmed = line.trim();
  let match: RegExpMatchArray | null;

  switch (type) {
    case "function":
      match = trimmed.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*[(<]/);
      if (!match) match = trimmed.match(/(?:const|let|var|pub\s+(?:async\s+)?fn|fn|(?:async\s+)?def)\s+(\w+)/);
      return match?.[1] ?? "anonymous";
    case "class":
      match = trimmed.match(/class\s+(\w+)/);
      if (!match) match = trimmed.match(/struct\s+(\w+)/);
      return match?.[1] ?? "Unknown";
    case "type":
      match = trimmed.match(/(?:type|interface|enum|trait)\s+(\w+)/);
      return match?.[1] ?? "Unknown";
    case "const":
      match = trimmed.match(/(?:const|let|var|static)\s+(\w+)/);
      if (!match) match = trimmed.match(/^([A-Z_][A-Z_0-9]*)\s*[=:]/);
      return match?.[1] ?? "unknown";
    default:
      return "unknown";
  }
}

/** Find the end of a block (matching braces, indentation, etc.) */
function findBlockEnd(lines: string[], start: number, lang: Language): number {
  if (lang === "python") {
    return findPythonBlockEnd(lines, start);
  }

  // Brace-based languages
  let braceCount = 0;
  let foundOpen = false;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        braceCount++;
        foundOpen = true;
      } else if (ch === "}") {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          return i;
        }
      }
    }
    // Single-line declaration without braces (e.g., type alias)
    if (i === start && !foundOpen && (line.includes(";") || !line.includes("{"))) {
      // Check if next line starts a block
      if (i + 1 < lines.length && lines[i + 1]?.trim().startsWith("{")) {
        continue;
      }
      // It's a single-line or multi-line without braces
      if (line.endsWith(";") || line.endsWith(",")) {
        return i;
      }
      // Type alias spanning multiple lines
      if (!line.includes("{")) {
        let end = i;
        while (end < lines.length - 1 && !lines[end].includes(";") && !lines[end + 1]?.match(/^\S/)) {
          end++;
        }
        return end;
      }
    }
  }

  // If no matching brace found, return a reasonable end
  return Math.min(start + 50, lines.length - 1);
}

/** Find end of a Python block using indentation */
function findPythonBlockEnd(lines: string[], start: number): number {
  const baseIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0;
  let end = start;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      end = i;
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= baseIndent) {
      break;
    }
    end = i;
  }

  return end;
}

/** Find end of a statement (semicolon or end of expression) */
function findStatementEnd(lines: string[], start: number, lang: Language): number {
  if (lang === "python") {
    // Python: single line or multi-line with continuation
    let end = start;
    while (end < lines.length - 1 && lines[end].trimEnd().endsWith("\\")) {
      end++;
    }
    // Check for multi-line expressions (parens, brackets)
    let parenCount = 0;
    let bracketCount = 0;
    for (let i = start; i <= Math.min(start + 20, lines.length - 1); i++) {
      for (const ch of lines[i]) {
        if (ch === "(" || ch === "[") parenCount++;
        if (ch === ")" || ch === "]") parenCount--;
        if (ch === "{") bracketCount++;
        if (ch === "}") bracketCount--;
      }
      end = i;
      if (parenCount <= 0 && bracketCount <= 0 && i >= start) break;
    }
    return end;
  }

  // Brace-based: find semicolon or closing brace at same level
  let braceCount = 0;
  for (let i = start; i < Math.min(start + 30, lines.length); i++) {
    for (const ch of lines[i]) {
      if (ch === "{" || ch === "[" || ch === "(") braceCount++;
      if (ch === "}" || ch === "]" || ch === ")") braceCount--;
    }
    if (braceCount <= 0 && (lines[i].includes(";") || lines[i].trimEnd().endsWith(","))) {
      return i;
    }
    if (braceCount === 0 && i > start && lines[i].trim() === "") {
      return i - 1;
    }
  }

  return start;
}

/** Extract a function signature (up to the opening brace or colon) */
function extractFunctionSignature(
  lines: string[],
  start: number,
  lang: Language
): string {
  if (lang === "python") {
    // Python: everything up to and including the colon
    let sig = "";
    for (let i = start; i < Math.min(start + 5, lines.length); i++) {
      sig += lines[i];
      if (lines[i].includes(":")) {
        // Trim to just the signature part
        const colonIdx = sig.lastIndexOf(":");
        return sig.substring(0, colonIdx + 1).trimEnd();
      }
      sig += "\n";
    }
    return lines[start].trimEnd();
  }

  // Brace-based languages: everything up to the opening brace
  let sig = "";
  let parenCount = 0;
  for (let i = start; i < Math.min(start + 10, lines.length); i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === "(") parenCount++;
      if (ch === ")") parenCount--;
      if (ch === "{" && parenCount === 0) {
        sig += line.substring(0, j).trimEnd();
        return sig.trimEnd();
      }
    }
    sig += line + "\n";
    // If line ends with a return type annotation and next line is {
    if (parenCount === 0 && i > start && lines[i + 1]?.trim().startsWith("{")) {
      return sig.trimEnd();
    }
  }

  return lines[start].trimEnd();
}

/** Truncate long values in const declarations */
function truncateValue(line: string): string {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return line;
  const beforeEq = line.substring(0, eqIdx + 1);
  const afterEq = line.substring(eqIdx + 1).trim();
  if (afterEq.length > 60) {
    return `${beforeEq} ${afterEq.substring(0, 50)}...`;
  }
  return line;
}

// ---------------------------------------------------------------------------
// Compression Implementations
// ---------------------------------------------------------------------------

/**
 * Full compression: return content as-is, truncating only if over maxChars.
 */
function compressFull(content: string, maxChars?: number): string {
  if (maxChars && content.length > maxChars) {
    const truncated = content.substring(0, maxChars);
    const lastNewline = truncated.lastIndexOf("\n");
    return (lastNewline > 0 ? truncated.substring(0, lastNewline) : truncated) +
      "\n// ... truncated";
  }
  return content;
}

/**
 * Skeleton compression: preserve structure with implementation bodies replaced.
 */
function compressSkeleton(
  lines: string[],
  elements: StructuralElement[],
  options: CompressionOptions
): string {
  const includeImports = options.includeImports !== false;
  const includeComments = options.includeComments === true;
  const output: string[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "import":
        if (includeImports) {
          output.push(el.signature);
        }
        break;

      case "comment":
        if (includeComments || el.isDocComment) {
          output.push(el.signature);
        }
        break;

      case "type":
        // Include full type/interface definitions (they're usually compact)
        output.push(lines.slice(el.startLine, el.endLine + 1).join("\n"));
        break;

      case "class":
        output.push(compressClassSkeleton(lines, el, options));
        break;

      case "function":
        output.push(`${el.signature} { /* ... */ }`);
        break;

      case "const":
        output.push(el.signature);
        break;
    }
  }

  // Add blank lines between sections for readability
  return output.join("\n\n");
}

/** Compress a class to show its structure with method signatures */
function compressClassSkeleton(
  lines: string[],
  element: StructuralElement,
  options: CompressionOptions
): string {
  const classLines = lines.slice(element.startLine, element.endLine + 1);
  const lang = detectLanguage("." + (options.language ?? "ts"));
  const patterns = getPatternsForLanguage(lang);
  const output: string[] = [element.signature + " {"];

  let i = 1; // Skip the class declaration line
  while (i < classLines.length - 1) {
    const line = classLines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // Property declarations
    if (
      /^\s*(private|protected|public|readonly|static|\#)/.test(line) &&
      !patterns.functionDecl.test(line) &&
      !/(async\s+)?\w+\s*\(/.test(trimmed)
    ) {
      output.push(line);
      i++;
      continue;
    }

    // Method declarations
    if (
      /(async\s+)?\w+\s*\(/.test(trimmed) ||
      /^\s*(private|protected|public|static|async)\s+/.test(line)
    ) {
      const sig = extractFunctionSignature(classLines, i, lang);
      output.push(`  ${sig.trim()} { /* ... */ }`);
      // Skip the method body
      let braceCount = 0;
      let foundOpen = false;
      for (let j = i; j < classLines.length; j++) {
        for (const ch of classLines[j]) {
          if (ch === "{") { braceCount++; foundOpen = true; }
          if (ch === "}") braceCount--;
        }
        if (foundOpen && braceCount === 0) {
          i = j + 1;
          break;
        }
      }
      if (!foundOpen) i++;
      continue;
    }

    // Doc comments before methods
    if (/^\s*(\/\*\*|\s*\*)/.test(line) && options.includeComments !== false) {
      let j = i;
      while (j < classLines.length && !classLines[j].includes("*/")) j++;
      output.push(...classLines.slice(i, j + 1));
      i = j + 1;
      continue;
    }

    i++;
  }

  output.push("}");
  return output.join("\n");
}

/**
 * Signatures compression: only export signatures, one line each.
 */
function compressSignatures(elements: StructuralElement[]): string {
  const output: string[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "function":
        output.push(el.signature.replace(/\s+/g, " ").trim());
        break;
      case "class":
        output.push(el.signature.trim());
        break;
      case "type":
        // Just the type name
        output.push(`type ${el.name}`);
        break;
      case "const":
        output.push(el.signature.split("=")[0].trim());
        break;
      // Skip imports and comments
    }
  }

  return output.join("\n");
}

/**
 * Summary compression: generate a single paragraph describing the file.
 */
function compressSummary(elements: StructuralElement[], filePath: string): string {
  const exports: string[] = [];
  const classes: string[] = [];
  const functions: string[] = [];
  const types: string[] = [];

  for (const el of elements) {
    if (el.type === "class") classes.push(el.name);
    else if (el.type === "function") functions.push(el.name);
    else if (el.type === "type") types.push(el.name);
  }

  // Collect all named exports
  for (const el of elements) {
    if (el.signature.includes("export") && el.name) {
      exports.push(el.name);
    }
  }

  const parts: string[] = [];
  const fileName = filePath.split("/").pop() ?? filePath;

  if (exports.length > 0) {
    parts.push(`exports ${formatList(exports)}`);
  }
  if (classes.length > 0) {
    parts.push(`defines class${classes.length > 1 ? "es" : ""} ${formatList(classes)}`);
  }
  if (functions.length > 0 && exports.length === 0) {
    parts.push(`contains function${functions.length > 1 ? "s" : ""} ${formatList(functions)}`);
  }
  if (types.length > 0) {
    parts.push(`declares type${types.length > 1 ? "s" : ""} ${formatList(types)}`);
  }

  if (parts.length === 0) {
    return `${fileName}: utility module`;
  }

  return `${fileName}: ${parts.join("; ")}.`;
}

/** Format a list of names for display */
function formatList(items: string[]): string {
  if (items.length <= 3) return items.join(", ");
  return `${items.slice(0, 3).join(", ")} (+${items.length - 3} more)`;
}

// ---------------------------------------------------------------------------
// Relevant Sections (Focused View)
// ---------------------------------------------------------------------------

/**
 * Create a focused view: full content around relevant lines, skeleton elsewhere.
 */
function compressWithRelevantSections(
  lines: string[],
  elements: StructuralElement[],
  options: CompressionOptions
): { content: string; preservedSections: { startLine: number; endLine: number }[] } {
  const contextRadius = options.contextLines ?? 3;
  const relevantLines = options.relevantLines ?? [];
  const relevantSymbols = options.relevantSymbols ?? [];

  // Build set of lines to show in full
  const fullLines = new Set<number>();

  // Add lines around relevant line numbers
  for (const lineNum of relevantLines) {
    for (let i = lineNum - contextRadius; i <= lineNum + contextRadius; i++) {
      if (i >= 0 && i < lines.length) {
        fullLines.add(i);
      }
    }
  }

  // Add lines for relevant symbols
  for (const symbol of relevantSymbols) {
    for (const el of elements) {
      if (el.name === symbol) {
        for (let i = el.startLine; i <= el.endLine; i++) {
          fullLines.add(i);
        }
      }
    }
  }

  // Build preserved sections (contiguous ranges)
  const preservedSections: { startLine: number; endLine: number }[] = [];
  const sortedLines = Array.from(fullLines).sort((a, b) => a - b);

  if (sortedLines.length > 0) {
    let sectionStart = sortedLines[0];
    let sectionEnd = sortedLines[0];

    for (let i = 1; i < sortedLines.length; i++) {
      if (sortedLines[i] <= sectionEnd + 2) {
        // Merge close sections (within 2 lines gap)
        sectionEnd = sortedLines[i];
      } else {
        preservedSections.push({ startLine: sectionStart, endLine: sectionEnd });
        sectionStart = sortedLines[i];
        sectionEnd = sortedLines[i];
      }
    }
    preservedSections.push({ startLine: sectionStart, endLine: sectionEnd });
  }

  // Build output: full sections interspersed with skeleton
  const output: string[] = [];
  let lastEnd = -1;

  for (const section of preservedSections) {
    // Add skeleton for gap between sections
    if (section.startLine > lastEnd + 1) {
      const gapElements = elements.filter(
        (el) => el.startLine > lastEnd && el.endLine < section.startLine
      );
      if (gapElements.length > 0) {
        output.push("// ...");
        for (const el of gapElements) {
          if (el.type === "function") {
            output.push(`${el.signature} { /* ... */ }`);
          } else if (el.type === "class") {
            output.push(`${el.signature} { /* ... */ }`);
          }
        }
        output.push("// ...");
      } else if (lastEnd >= 0) {
        output.push("// ...");
      }
    }

    // Add full content for this section
    output.push(lines.slice(section.startLine, section.endLine + 1).join("\n"));
    lastEnd = section.endLine;
  }

  // Add skeleton for remaining content after last section
  if (lastEnd < lines.length - 1) {
    const remainingElements = elements.filter((el) => el.startLine > lastEnd);
    if (remainingElements.length > 0) {
      output.push("// ...");
      for (const el of remainingElements) {
        if (el.type === "function") {
          output.push(`${el.signature} { /* ... */ }`);
        }
      }
    }
  }

  return { content: output.join("\n"), preservedSections };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compress a file's content based on the specified level and options.
 *
 * @param content - The full file content
 * @param filePath - Path to the file (used for language detection and headers)
 * @param options - Compression options
 * @returns Compressed file with metadata
 */
export function compressFile(
  content: string,
  filePath: string,
  options?: CompressionOptions
): CompressedFile {
  const opts: CompressionOptions = {
    level: "skeleton",
    includeImports: true,
    includeComments: false,
    contextLines: 3,
    ...options,
  };

  const lang = opts.language
    ? (EXTENSION_MAP[opts.language] ?? detectLanguage(filePath))
    : detectLanguage(filePath);
  const lines = content.split("\n");
  const originalLines = lines.length;

  // Full compression: just truncate
  if (opts.level === "full") {
    const compressed = compressFull(content, opts.maxChars);
    const compressedLines = compressed.split("\n").length;
    return {
      content: compressed,
      originalLines,
      compressedLines,
      compressionRatio: compressedLines / originalLines,
      preservedSections: [{ startLine: 0, endLine: compressedLines - 1 }],
    };
  }

  // Extract structural elements
  const elements = extractStructure(lines, lang);

  // If relevant lines/symbols provided, use focused view
  if (
    (opts.relevantLines && opts.relevantLines.length > 0) ||
    (opts.relevantSymbols && opts.relevantSymbols.length > 0)
  ) {
    const { content: compressed, preservedSections } = compressWithRelevantSections(
      lines,
      elements,
      opts
    );
    const finalContent = opts.maxChars
      ? compressFull(compressed, opts.maxChars)
      : compressed;
    const compressedLines = finalContent.split("\n").length;
    return {
      content: finalContent,
      originalLines,
      compressedLines,
      compressionRatio: compressedLines / originalLines,
      preservedSections,
    };
  }

  // Apply compression level
  let compressed: string;
  switch (opts.level) {
    case "skeleton": {
      const header = `// ${filePath} (skeleton)`;
      compressed = header + "\n" + compressSkeleton(lines, elements, opts);
      break;
    }
    case "signatures": {
      const header = `// ${filePath} (signatures)`;
      compressed = header + "\n" + compressSignatures(elements);
      break;
    }
    case "summary":
      compressed = compressSummary(elements, filePath);
      break;
    default:
      compressed = content;
  }

  // Apply maxChars truncation
  if (opts.maxChars && compressed.length > opts.maxChars) {
    compressed = compressFull(compressed, opts.maxChars);
  }

  const compressedLineCount = compressed.split("\n").length;
  return {
    content: compressed,
    originalLines,
    compressedLines: compressedLineCount,
    compressionRatio: compressedLineCount / originalLines,
    preservedSections: [],
  };
}

/**
 * Compress multiple files to fit within a total character budget.
 * Files are prioritized by relevance score, with higher-relevance files
 * receiving more generous compression levels.
 *
 * @param files - Array of files with path, content, and relevance score (0–1)
 * @param totalBudget - Total character budget for all files combined
 * @param options - Default compression options
 * @returns Array of compressed files with their paths
 */
export function compressFilesForContext(
  files: { path: string; content: string; relevance: number }[],
  totalBudget: number,
  options?: { defaultLevel?: CompressionLevel }
): { path: string; compressed: CompressedFile }[] {
  if (files.length === 0) return [];

  // Sort by relevance (highest first)
  const sorted = [...files].sort((a, b) => b.relevance - a.relevance);

  // Determine compression level for each file based on position
  const assignments: {
    file: (typeof sorted)[0];
    level: CompressionLevel;
    budgetShare: number;
  }[] = [];

  const totalRelevance = sorted.reduce((sum, f) => sum + f.relevance, 0) || 1;

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    let level: CompressionLevel;

    if (i < 3) {
      // Top 3 files: full or skeleton depending on size
      level = file.content.length < totalBudget * 0.2 ? "full" : "skeleton";
    } else if (i < 8) {
      // Next 5 files: skeleton
      level = "skeleton";
    } else {
      // Remaining: signatures or summary
      level = i < 15 ? "signatures" : "summary";
    }

    // Override with default level if specified and it's more compressed
    if (options?.defaultLevel) {
      const levelOrder: CompressionLevel[] = ["full", "skeleton", "signatures", "summary"];
      const defaultIdx = levelOrder.indexOf(options.defaultLevel);
      const currentIdx = levelOrder.indexOf(level);
      if (defaultIdx > currentIdx) {
        level = options.defaultLevel;
      }
    }

    // Budget share proportional to relevance
    const budgetShare = (file.relevance / totalRelevance) * totalBudget;
    assignments.push({ file, level, budgetShare });
  }

  // First pass: compress each file with its assigned level and budget
  let results: { path: string; compressed: CompressedFile }[] = [];
  let totalUsed = 0;

  for (const { file, level, budgetShare } of assignments) {
    const compressed = compressFile(file.content, file.path, {
      level,
      maxChars: Math.floor(budgetShare),
    });
    results.push({ path: file.path, compressed });
    totalUsed += compressed.content.length;
  }

  // Second pass: if over budget, progressively compress more
  if (totalUsed > totalBudget) {
    const levelOrder: CompressionLevel[] = ["full", "skeleton", "signatures", "summary"];

    // Start from the least relevant files and increase compression
    for (let i = results.length - 1; i >= 0 && totalUsed > totalBudget; i--) {
      const assignment = assignments[i];
      const currentLevelIdx = levelOrder.indexOf(assignment.level);

      if (currentLevelIdx < levelOrder.length - 1) {
        const newLevel = levelOrder[currentLevelIdx + 1];
        const recompressed = compressFile(assignment.file.content, assignment.file.path, {
          level: newLevel,
          maxChars: Math.floor(assignment.budgetShare * 0.5),
        });

        totalUsed -= results[i].compressed.content.length;
        totalUsed += recompressed.content.length;
        results[i] = { path: assignment.file.path, compressed: recompressed };
      }
    }
  }

  // Final pass: hard truncate if still over budget
  if (totalUsed > totalBudget) {
    let remaining = totalBudget;
    const finalResults: typeof results = [];

    for (const result of results) {
      if (remaining <= 0) break;
      if (result.compressed.content.length <= remaining) {
        finalResults.push(result);
        remaining -= result.compressed.content.length;
      } else {
        // Truncate this file to fit
        const truncated = compressFile(result.compressed.content, result.path, {
          level: "full",
          maxChars: remaining,
        });
        finalResults.push({ path: result.path, compressed: truncated });
        remaining = 0;
      }
    }

    results = finalResults;
  }

  return results;
}

/**
 * Generate a one-line summary of a file's purpose and exports.
 *
 * @param content - The full file content
 * @param filePath - Path to the file
 * @returns A concise one-line summary
 */
export function summarizeFile(content: string, filePath: string): string {
  const lang = detectLanguage(filePath);
  const lines = content.split("\n");
  const elements = extractStructure(lines, lang);
  return compressSummary(elements, filePath);
}
