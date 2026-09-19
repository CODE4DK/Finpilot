import { MissingEnvError, readEnv, tryReadEnv } from '@/lib/env';

const VALID = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  EXPO_PUBLIC_POWERSYNC_URL: 'https://example.powersync.journeyapps.com',
};

describe('readEnv', () => {
  it('maps the public variables onto a typed object', () => {
    expect(readEnv(VALID)).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      powersyncUrl: 'https://example.powersync.journeyapps.com',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(
      readEnv({ ...VALID, EXPO_PUBLIC_SUPABASE_ANON_KEY: '  anon-key  ' }).supabaseAnonKey,
    ).toBe('anon-key');
  });

  it('names every missing variable', () => {
    expect(() => readEnv({ EXPO_PUBLIC_SUPABASE_URL: VALID.EXPO_PUBLIC_SUPABASE_URL })).toThrow(
      MissingEnvError,
    );

    try {
      readEnv({});
    } catch (error) {
      expect((error as MissingEnvError).keys).toEqual([
        'EXPO_PUBLIC_SUPABASE_URL',
        'EXPO_PUBLIC_SUPABASE_ANON_KEY',
        'EXPO_PUBLIC_POWERSYNC_URL',
      ]);
    }
  });

  it('treats a blank value as missing', () => {
    expect(() => readEnv({ ...VALID, EXPO_PUBLIC_POWERSYNC_URL: '   ' })).toThrow(MissingEnvError);
  });
});

describe('tryReadEnv', () => {
  it('returns null instead of throwing', () => {
    expect(tryReadEnv({})).toBeNull();
    expect(tryReadEnv(VALID)).not.toBeNull();
  });
});
