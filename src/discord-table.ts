/**
 * discord-table.ts
 *
 * Provides two strategies for rendering Markdown tables in Discord:
 *
 *   1. ASCII art  (convertMarkdownTables)  — plain text, font-dependent
 *   2. Embeds     (splitForDiscord)        — Discord's native layout, font-independent ✓
 *
 * Strategy 2 is preferred for Discord.  Strategy 1 is kept as a fallback
 * and for non-Discord contexts.
 */

// ─── Shared parser ────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isAlignRow(line: string): boolean {
  return /^[\s|:\-]+$/.test(line);
}

interface ParsedTable {
  header: string[];
  rows: string[][];
}

function parseTable(block: string): ParsedTable | null {
  const lines = block.split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2 || !isAlignRow(lines[1])) return null;
  return {
    header: parseRow(lines[0]),
    rows: lines.slice(2).map(parseRow),
  };
}

// ─── Strategy 1: ASCII art ────────────────────────────────────────────────────

/** Display width inside a Discord code block (all codepoints = 1 col). */
function dispLen(s: string): number {
  return [...s].length;
}

function padStr(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - dispLen(s)));
}

/** Render a borderless table: header + dash-separator + rows, space-separated. */
function renderAsciiTable(t: ParsedTable): string {
  const allRows = [t.header, ...t.rows];
  const cols = t.header.length;
  const COL_GAP = 2; // spaces between columns
  const widths = Array.from({ length: cols }, (_, ci) =>
    Math.max(...allRows.map((row) => dispLen(row[ci] ?? ''))),
  );
  // Last column needs no padding
  const dataRow = (cells: string[]) =>
    cells
      .map((c, i) =>
        i < cols - 1 ? padStr(c ?? '', widths[i] + COL_GAP) : (c ?? ''),
      )
      .join('');
  const separator = widths
    .map((w, i) => '-'.repeat(i < cols - 1 ? w + COL_GAP : w))
    .join('');
  return (
    '```\n' +
    [dataRow(t.header), separator, ...t.rows.map((r) => dataRow(r))].join(
      '\n',
    ) +
    '\n```'
  );
}

/** Convert all Markdown tables in `text` to ASCII art code blocks. */
export function convertMarkdownTables(text: string): string {
  const TABLE_RE = /(?:^|\n)((?:\|[^\n]+\n?){2,})/g;
  return text.replace(TABLE_RE, (match, block: string) => {
    const leading = match.startsWith('\n') ? '\n' : '';
    const parsed = parseTable(block.trimEnd());
    return parsed ? leading + renderAsciiTable(parsed) : match;
  });
}

// ─── Strategy 2: Discord Embeds ───────────────────────────────────────────────

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface TableEmbedData {
  fields: EmbedField[];
  color: number;
}

const EMBED_COLOR = 0x5865f2; // Discord blurple

/**
 * Convert a parsed table to embed field data.
 *
 * Layout strategy:
 *   - ≤3 columns → inline fields (column-per-field, all rows joined with \n)
 *   - >3 columns → one field per row (label = row index, value = all cells)
 *
 * Inline column layout looks like:
 *   ┌──────────┬──────────────────────┐
 *   │ 時刻     │ 状況                 │  ← field names (header)
 *   │ 01:08    │ 障害発生             │  ← field values (rows joined)
 *   │ 09:30    │ ベンダーと...        │
 *   └──────────┴──────────────────────┘
 */
function tableToEmbedData(t: ParsedTable): TableEmbedData {
  const cols = t.header.length;

  if (cols <= 3) {
    // One inline field per column
    const fields: EmbedField[] = t.header.map((hdr, ci) => ({
      name: hdr || '\u200b', // zero-width space for empty header
      value: t.rows.map((r) => r[ci] ?? '').join('\n') || '\u200b',
      inline: true,
    }));
    return { fields, color: EMBED_COLOR };
  } else {
    // One field per row: "col1 | col2 | col3 | ..."
    const fields: EmbedField[] = [
      {
        name: t.header.join(' | '),
        value: t.rows.map((r) => r.join(' | ')).join('\n') || '\u200b',
        inline: false,
      },
    ];
    return { fields, color: EMBED_COLOR };
  }
}

export interface DiscordPayload {
  /** Plain text content (tables removed, surrounding text kept). */
  content: string;
  /** One embed per table found in the original text. */
  embeds: TableEmbedData[];
}

/**
 * Split a message into plain-text content and embed data.
 * Tables are extracted into embeds; the rest is returned as `content`.
 *
 * Use this in Discord's sendMessage instead of convertMarkdownTables.
 */
export function splitForDiscord(text: string): DiscordPayload {
  const embeds: TableEmbedData[] = [];
  const TABLE_RE = /(?:^|\n)((?:\|[^\n]+\n?){2,})/g;

  const content = text
    .replace(TABLE_RE, (match, block: string) => {
      const leading = match.startsWith('\n') ? '\n' : '';
      const parsed = parseTable(block.trimEnd());
      if (!parsed) return match;
      embeds.push(tableToEmbedData(parsed));
      return leading; // remove table text; embed replaces it visually
    })
    .trim();

  return { content, embeds };
}
