import { describe, it, expect } from 'vitest';
import { parseLeads } from '../utils/csvParser';

describe('CSV / TXT Parser', () => {
  it('should parse valid CSV and identify valid/invalid emails', () => {
    const csvContent = Buffer.from('test1@example.com\ninvalid-email\ntest2@example.com\n');
    const result = parseLeads(csvContent, true);

    expect(result.total).toBe(3);
    expect(result.valid).toHaveLength(2);
    expect(result.valid).toContain('test1@example.com');
    expect(result.valid).toContain('test2@example.com');
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid).toContain('invalid-email');
    expect(result.duplicates).toBe(0);
  });

  it('should identify duplicates', () => {
    const txtContent = Buffer.from('test@example.com\ntest@example.com\nanothertest@example.com');
    const result = parseLeads(txtContent, false);

    expect(result.total).toBe(3);
    expect(result.valid).toHaveLength(2);
    expect(result.duplicates).toBe(1);
  });

  it('should parse TXT correctly separated by commas or spaces', () => {
    const txtContent = Buffer.from('test1@example.com, test2@example.com test3@example.com');
    const result = parseLeads(txtContent, false);

    expect(result.total).toBe(3);
    expect(result.valid).toHaveLength(3);
  });
});
