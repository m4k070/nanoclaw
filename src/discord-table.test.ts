import { describe, it, expect } from 'vitest';
import { convertMarkdownTables } from './discord-table.js';

describe('convertMarkdownTables', () => {
  it('converts a simple ASCII table', () => {
    const input = `| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |`;
    const result = convertMarkdownTables(input);
    expect(result).toContain('```');
    expect(result).toContain('Alice');
    expect(result).toContain('┌');
    expect(result).toContain('┘');
  });

  it('handles CJK text with codepoint-based widths', () => {
    const input = `| 名前 | 役職 |\n| --- | --- |\n| 田中 | 開発者 |`;
    const result = convertMarkdownTables(input);
    // Each CJK char = 1 column in Discord
    // "名前" = 2 codepoints, "役職" = 2 codepoints
    // "田中" = 2 codepoints, "開発者" = 3 codepoints
    // Column 1 width = max(2, 2) = 2, Column 2 width = max(2, 3) = 3
    expect(result).toContain('名前');
    expect(result).toContain('田中');
    const lines = result.split('\n').filter((l) => l.includes('│'));
    // All data rows should have equal length
    const rowLengths = lines.map((l) => [...l].length);
    expect(new Set(rowLengths).size).toBe(1);
  });

  it('leaves non-table text unchanged', () => {
    const input = 'Hello **world**\n- item1\n- item2';
    expect(convertMarkdownTables(input)).toBe(input);
  });

  it('handles mixed content (text + table + text)', () => {
    const input = `Intro text\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nTrailing text`;
    const result = convertMarkdownTables(input);
    expect(result).toContain('Intro text');
    expect(result).toContain('Trailing text');
    expect(result).toContain('```');
  });
});
