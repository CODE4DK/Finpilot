import {
  classifyUploadError,
  describeUploadError,
  isPermanentUploadError,
} from '@/db/upload-errors';

describe('classifyUploadError', () => {
  it.each([
    ['23505', 'unique violation'],
    ['23503', 'foreign key violation'],
    ['23514', 'check constraint violation'],
    ['23502', 'not-null violation'],
    ['42501', 'RLS refusal'],
    ['22003', 'numeric out of range'],
  ])('treats SQLSTATE %s (%s) as permanent', (code) => {
    expect(classifyUploadError({ code })).toBe('permanent');
  });

  it.each([
    ['08006', 'connection failure'],
    ['53300', 'too many connections'],
    ['57014', 'query cancelled'],
    ['40001', 'serialization failure'],
  ])('treats SQLSTATE %s (%s) as transient', (code) => {
    expect(classifyUploadError({ code })).toBe('transient');
  });

  it.each([400, 401, 403, 404, 409, 422])('treats HTTP %d as permanent', (status) => {
    expect(classifyUploadError({ status })).toBe('permanent');
  });

  it.each([429, 500, 502, 503, 504])('treats HTTP %d as transient', (status) => {
    expect(classifyUploadError({ status })).toBe('transient');
  });

  it('treats a dropped connection as transient', () => {
    expect(classifyUploadError(new TypeError('Network request failed'))).toBe('transient');
    expect(classifyUploadError({ message: 'timeout of 30000ms exceeded' })).toBe('transient');
  });

  it('errs toward retrying when it does not recognise the failure', () => {
    // Discarding a write we do not understand would lose the user's data.
    expect(classifyUploadError({ message: 'something strange' })).toBe('transient');
    expect(classifyUploadError(null)).toBe('transient');
    expect(classifyUploadError(undefined)).toBe('transient');
    expect(classifyUploadError({ code: 'PGRST116' })).toBe('transient');
  });

  it('exposes a boolean helper', () => {
    expect(isPermanentUploadError({ code: '23505' })).toBe(true);
    expect(isPermanentUploadError({ status: 503 })).toBe(false);
  });
});

describe('describeUploadError', () => {
  it('summarises code, status and message', () => {
    expect(describeUploadError({ code: '23505', message: 'duplicate key' })).toBe(
      'code=23505 duplicate key',
    );
    expect(describeUploadError({ status: 403, message: 'forbidden' })).toBe('status=403 forbidden');
  });

  it('copes with an error carrying nothing useful', () => {
    expect(describeUploadError({})).toBe('unknown error');
    expect(describeUploadError(null)).toBe('unknown error');
  });
});
