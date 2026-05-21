import { describe, it, expect } from 'vitest';
import { fmtEUR, signedEUR, pct, formatCell } from '../lib/format';

describe('fmtEUR', () => {
  it('formats values below 10,000 with two decimal places', () => {
    const result = fmtEUR(1234.56);
    expect(result).toContain('1,234.56');
  });

  it('formats values >= 10,000 without decimal places', () => {
    const result = fmtEUR(12345.67);
    expect(result).toContain('12,346');
    expect(result).not.toMatch(/\.\d{2}$/);
  });

  it('returns em-dash for null', () => {
    expect(fmtEUR(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(fmtEUR(undefined)).toBe('—');
  });

  it('returns em-dash for NaN', () => {
    expect(fmtEUR(NaN)).toBe('—');
  });
});

describe('signedEUR', () => {
  it('prepends + for positive values', () => {
    const result = signedEUR(500);
    expect(result).toMatch(/^\+/);
  });

  it('does not prepend + for negative values', () => {
    const result = signedEUR(-200);
    expect(result).not.toMatch(/^\+/);
  });

  it('returns em-dash for null', () => {
    expect(signedEUR(null)).toBe('—');
  });
});

describe('pct', () => {
  it('formats a positive number with a + prefix', () => {
    expect(pct(5.25)).toBe('+5.25%');
  });

  it('formats a negative number without + prefix', () => {
    expect(pct(-3.1)).toBe('-3.10%');
  });

  it('respects the digits argument', () => {
    expect(pct(1.5, 0)).toBe('+2%');
  });

  it('returns em-dash for null', () => {
    expect(pct(null)).toBe('—');
  });

  it('returns em-dash for NaN', () => {
    expect(pct(NaN)).toBe('—');
  });
});

describe('formatCell', () => {
  it('returns em-dash for null', () => {
    expect(formatCell(null)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatCell('')).toBe('—');
  });

  it('formats large integers with locale formatting', () => {
    expect(formatCell(100000)).toContain('100');
  });

  it('formats small decimals with two decimal places', () => {
    expect(formatCell(0.5)).toBe('0.50');
  });

  it('passes strings through unchanged', () => {
    expect(formatCell('AAPL')).toBe('AAPL');
  });
});
