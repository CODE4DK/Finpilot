/**
 * The only configuration the client is allowed to read. Expo inlines
 * EXPO_PUBLIC_* variables into the bundle at build time, so anything secret
 * (service-role keys, webhook signing secrets) belongs in an Edge Function.
 */
export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  powersyncUrl: string;
}

export class MissingEnvError extends Error {
  constructor(public readonly keys: string[]) {
    super(
      `Missing required environment variable(s): ${keys.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.',
    );
    this.name = 'MissingEnvError';
  }
}

const RAW_ENV = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_POWERSYNC_URL: process.env.EXPO_PUBLIC_POWERSYNC_URL,
} as const;

type RawEnv = Partial<Record<keyof typeof RAW_ENV, string | undefined>>;

/** Pure, so it can be unit tested without touching process.env. */
export function readEnv(raw: RawEnv = RAW_ENV): AppEnv {
  const missing = (Object.keys(RAW_ENV) as (keyof typeof RAW_ENV)[]).filter(
    (key) => !raw[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }
  return {
    supabaseUrl: raw.EXPO_PUBLIC_SUPABASE_URL!.trim(),
    supabaseAnonKey: raw.EXPO_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    powersyncUrl: raw.EXPO_PUBLIC_POWERSYNC_URL!.trim(),
  };
}

/** Non-throwing variant for screens that should degrade rather than crash. */
export function tryReadEnv(raw: RawEnv = RAW_ENV): AppEnv | null {
  try {
    return readEnv(raw);
  } catch {
    return null;
  }
}
