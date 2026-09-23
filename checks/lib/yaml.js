'use strict';

// A deliberately small YAML-subset parser.
//
// Why hand-rolled: this repo ships no dependencies (see docs/adr/0015), and the
// structural checks must run from a bare checkout with nothing but Node.
//
// Supported subset — enough for AGENTS.md frontmatter and SKILL.md frontmatter,
// and no more: block mappings nested by indentation, block sequences of scalars,
// plain / single-quoted / double-quoted scalars, literal (`|`) and folded (`>`)
// block scalars, flow sequences of scalars (`[a, "b"]`), `#` comments and blank
// lines. Anything outside that subset raises a YamlError carrying a line number,
// which is what check 5 reports.

class YamlError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'YamlError';
    this.line = line;
  }
}

function unquote(text, lineNo) {
  const quote = text[0];
  let out = '';
  let i = 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote === '"' && c === '\\') {
      const next = text[++i];
      if (next === undefined) throw new YamlError('dangling escape in a double-quoted scalar', lineNo);
      out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      continue;
    }
    if (c === quote) {
      if (quote === "'" && text[i + 1] === "'") { out += "'"; i++; continue; }
      break;
    }
    out += c;
  }
  if (i >= text.length) throw new YamlError('unterminated quoted scalar', lineNo);
  const rest = text.slice(i + 1).trim();
  if (rest !== '' && !rest.startsWith('#')) {
    throw new YamlError(`unexpected text after a quoted scalar: ${rest}`, lineNo);
  }
  return out;
}

function stripPlainComment(text) {
  const at = text.search(/(^|\s)#/);
  return (at === -1 ? text : text.slice(0, at)).trim();
}

function parseFlowSequence(text, lineNo) {
  const closed = text.lastIndexOf(']');
  if (closed === -1) throw new YamlError('unterminated flow sequence', lineNo);
  const body = text.slice(1, closed).trim();
  const tail = stripPlainComment(text.slice(closed + 1));
  if (tail !== '') throw new YamlError(`unexpected text after a flow sequence: ${tail}`, lineNo);
  if (body === '') return [];
  return body.split(',').map((item) => {
    const value = item.trim();
    if (value[0] === '"' || value[0] === "'") return unquote(value, lineNo);
    return value;
  });
}

function scalarFromInline(text, lineNo) {
  if (text[0] === '"' || text[0] === "'") return unquote(text, lineNo);
  if (text[0] === '[') return parseFlowSequence(text, lineNo);
  const plain = stripPlainComment(text);
  if (plain === '~' || plain === 'null') return null;
  if (plain === 'true') return true;
  if (plain === 'false') return false;
  return plain;
}

const KEY = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*:(\s|$)/;
const BLOCK_HEADER = /^[|>][-+]?\s*$/;

// Returns { value, next } where `next` is the index of the first unconsumed line.
function parseBlock(lines, start, indent) {
  let i = start;
  let container = null;

  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim() === '' || raw.trim().startsWith('#')) { i++; continue; }
    if (/\t/.test(raw.slice(0, raw.length - raw.trimStart().length))) {
      throw new YamlError('tab used for indentation', i + 1);
    }
    const currentIndent = raw.length - raw.trimStart().length;
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new YamlError(`unexpected indentation (expected ${indent} spaces, found ${currentIndent})`, i + 1);
    }

    const rest = raw.slice(indent);

    if (rest === '-' || rest.startsWith('- ')) {
      if (container === null) container = [];
      if (!Array.isArray(container)) throw new YamlError('sequence item inside a mapping', i + 1);
      const itemText = rest.slice(1).trim();
      if (itemText === '') {
        const nested = parseBlock(lines, i + 1, indent + 2);
        container.push(nested.value);
        i = nested.next;
        continue;
      }
      const asKey = itemText.match(KEY);
      if (asKey) throw new YamlError('mapping inside a sequence item is outside the supported subset', i + 1);
      container.push(scalarFromInline(itemText, i + 1));
      i++;
      continue;
    }

    const match = rest.match(KEY);
    if (!match) throw new YamlError(`line is neither a mapping key nor a sequence item: ${rest.slice(0, 60)}`, i + 1);
    if (container === null) container = {};
    if (Array.isArray(container)) throw new YamlError('mapping key inside a sequence', i + 1);
    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(container, key)) {
      throw new YamlError(`duplicate key: ${key}`, i + 1);
    }
    const value = rest.slice(match[0].length).trim();

    if (value === '' || value.startsWith('#')) {
      const nested = parseBlock(lines, i + 1, indent + 2);
      container[key] = nested.value;
      i = nested.next;
      continue;
    }
    if (BLOCK_HEADER.test(value)) {
      const folded = value[0] === '>';
      const collected = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const bodyLine = lines[j];
        if (bodyLine.trim() === '') { collected.push(''); continue; }
        const bodyIndent = bodyLine.length - bodyLine.trimStart().length;
        if (bodyIndent <= indent) break;
        collected.push(bodyLine.slice(indent + 2));
      }
      container[key] = folded ? collected.join(' ').trim() : collected.join('\n').trim();
      i = j;
      continue;
    }
    container[key] = scalarFromInline(value, i + 1);
    i++;
  }

  return { value: container === null ? null : container, next: i };
}

function parse(text) {
  const lines = text.split('\n');
  const { value } = parseBlock(lines, 0, 0);
  return value === null ? {} : value;
}

// Extracts the leading `---` fenced frontmatter block of a Markdown file.
// Returns null when the file does not open with one.
function frontmatterOf(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { body: lines.slice(1, i).join('\n'), firstLine: 2, lastLine: i };
    }
  }
  return null;
}

function parseFrontmatter(text) {
  const block = frontmatterOf(text);
  if (block === null) return null;
  try {
    return { data: parse(block.body), block };
  } catch (err) {
    if (err instanceof YamlError) {
      // Re-throw with the line number translated into the containing file.
      throw new YamlError(err.message, err.line + 1);
    }
    throw err;
  }
}

module.exports = { parse, parseFrontmatter, frontmatterOf, YamlError };
