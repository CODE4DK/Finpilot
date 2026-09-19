import {
  CONFIRMATION_WORD,
  EXPORTED_TABLES,
  MAX_NAME_LENGTH,
  buildExport,
  describeProfileProblem,
  exportFileName,
  isConfirmed,
  isSafeExternalUrl,
  LEGAL_LINKS,
  toProfileUpdate,
  validateProfileDraft,
} from '@/features/settings';

describe('validateProfileDraft', () => {
  const valid = { fullName: 'Alice Kapoor', currency: 'INR' };

  it('accepts an ordinary name', () => {
    expect(validateProfileDraft(valid)).toEqual([]);
  });

  it('accepts an empty name - a profile does not require one', () => {
    expect(validateProfileDraft({ ...valid, fullName: '' })).toEqual([]);
  });

  it('rejects a name past the database limit, before the database does', () => {
    const problems = validateProfileDraft({ ...valid, fullName: 'a'.repeat(MAX_NAME_LENGTH + 1) });

    expect(problems).toEqual(['name_too_long']);
    expect(describeProfileProblem('name_too_long')).toContain(String(MAX_NAME_LENGTH));
  });

  it('measures the trimmed name, so trailing spaces are not an error', () => {
    expect(
      validateProfileDraft({ ...valid, fullName: `${'a'.repeat(MAX_NAME_LENGTH)}   ` }),
    ).toEqual([]);
  });

  it('rejects control characters, which would spoof a row in the export', () => {
    expect(validateProfileDraft({ ...valid, fullName: 'Alice\nKapoor' })).toContain('name_invalid');
    expect(validateProfileDraft({ ...valid, fullName: 'Alice​Kapoor' })).toContain('name_invalid');
    expect(validateProfileDraft({ ...valid, fullName: 'Alice\u0000' })).toContain('name_invalid');
  });

  it('accepts a name in Devanagari, which is not a control character', () => {
    expect(validateProfileDraft({ ...valid, fullName: 'अलीशा कपूर' })).toEqual([]);
  });

  it('rejects a currency the app cannot actually render', () => {
    expect(validateProfileDraft({ ...valid, currency: 'USD' })).toEqual(['currency_unsupported']);
  });
});

describe('toProfileUpdate', () => {
  it('trims, and stores an empty name as null rather than an empty string', () => {
    expect(toProfileUpdate({ fullName: '  Alice  ', currency: 'INR' })).toEqual({
      full_name: 'Alice',
      currency: 'INR',
    });
    expect(toProfileUpdate({ fullName: '   ', currency: 'INR' }).full_name).toBeNull();
  });
});

describe('the delete confirmation', () => {
  it('needs the word, not a tap', () => {
    expect(isConfirmed(CONFIRMATION_WORD)).toBe(true);
    expect(isConfirmed('yes')).toBe(false);
    expect(isConfirmed('')).toBe(false);
  });

  it('forgives case and whitespace - it is a gate, not a spelling test', () => {
    expect(isConfirmed(' delete ')).toBe(true);
    expect(isConfirmed('Delete')).toBe(true);
  });

  it('does not accept a word that merely contains it', () => {
    expect(isConfirmed('delete everything')).toBe(false);
  });
});

describe('buildExport', () => {
  const tables = {
    accounts: [{ id: 'a1' }],
    transactions: [{ id: 't1' }, { id: 't2' }],
  };

  it('includes every table, even the empty ones', () => {
    const archive = buildExport(tables, { appVersion: '1.0.0' });

    expect(Object.keys(archive.tables).sort()).toEqual([...EXPORTED_TABLES].sort());
    expect(archive.tables.goals).toEqual([]);
  });

  it('counts the rows, so the app can tell the user what it exported', () => {
    const archive = buildExport(tables, { appVersion: '1.0.0' });

    expect(archive.counts.transactions).toBe(2);
    expect(archive.counts.insights).toBe(0);
  });

  it('records the format, the version and that amounts are paise', () => {
    // Whoever opens this file in three years needs to know 184550 is rupees
    // 1,845.50 and not rupees 184,550.
    const archive = buildExport(tables, {
      appVersion: '1.2.3',
      now: new Date('2026-09-19T10:00:00.000Z'),
    });

    expect(archive.format).toBe('finpilot.export.v1');
    expect(archive.app_version).toBe('1.2.3');
    expect(archive.amounts).toBe('integer_paise');
    expect(archive.exported_at).toBe('2026-09-19T10:00:00.000Z');
  });

  it('names the file after the day it was taken', () => {
    expect(exportFileName(new Date(2026, 8, 19))).toBe('finpilot-export-2026-09-19.json');
  });
});

describe('the legal links', () => {
  it('are all https, because only https is ever opened', () => {
    expect(LEGAL_LINKS.every((link) => isSafeExternalUrl(link.url))).toBe(true);
  });

  it('refuses anything that is not https', () => {
    expect(isSafeExternalUrl('http://finpilot.app/privacy')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });

  it('covers both documents the stores require', () => {
    expect(LEGAL_LINKS.map((link) => link.title)).toEqual(['Privacy policy', 'Terms of use']);
  });
});
