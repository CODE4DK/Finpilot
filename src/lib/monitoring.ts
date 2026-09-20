/**
 * Crash and error reporting.
 *
 * The premise is the same as `logger.ts`, one step further out: a crash
 * report is a log line that leaves the device, so the redaction has to be
 * stricter, not looser. Sentry sees the shape of a failure - which screen,
 * which call, which line - and never an amount, a note, an account name or
 * an email.
 *
 * Reporting is **off in development**. A developer watching a stack trace in
 * Metro does not need it in Sentry too, and the noise is what makes a real
 * release's issues easy to miss.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { redact } from './logger';

export interface MonitoringConfig {
  dsn?: string;
  /** 'development' | 'staging' | 'production' - the EAS profile's environment. */
  environment: string;
  /** "1.0.0 (42)" - what a Sentry release is named after. */
  release: string;
  /** The EAS Update channel, so an OTA-patched build is distinguishable. */
  channel?: string;
  enabled: boolean;
}

/** Everything the app knows about which build it is. */
export function readMonitoringConfig(): MonitoringConfig {
  const extra = Constants.expoConfig?.extra ?? {};
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = Constants.expoConfig?.runtimeVersion ?? '';

  return {
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    release: `finpilot@${version}${build ? `+${String(build)}` : ''}`,
    channel: typeof extra.channel === 'string' ? extra.channel : undefined,
    // Two switches, and both must be on: the variant has to want reporting
    // (development does not) and a DSN has to exist.
    enabled: Boolean(extra.sentryEnabled) && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  };
}

/**
 * Keys whose values never leave the device, whatever they are attached to.
 *
 * Matched case-insensitively against the key, not the value, because the
 * value is the thing being protected.
 */
const FORBIDDEN_KEYS =
  /(amount|paise|balance|limit|target|saved|spent|note|email|phone|token|password|pin|salt|hash|full_name|account_name|category_name|summary|address)/i;

/** Sentry's own keys for the user object, which we deliberately do not fill. */
const USER_KEYS = ['email', 'ip_address', 'username', 'name'] as const;

/**
 * Walks anything bound for Sentry and removes what must not travel.
 *
 * Deliberately aggressive: a key called `amount_paise` loses its value even
 * in a breadcrumb about a network request, because that is exactly where one
 * shows up. Strings go through the same redactor the local logger uses.
 */
export function scrub<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redact(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => scrub(entry, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = FORBIDDEN_KEYS.test(key) ? '[redacted]' : scrub(child, depth + 1);
    }
    return result as unknown as T;
  }

  return value;
}

/**
 * The last thing that runs before an event is sent.
 *
 * Returning null drops the event entirely. Everything else is scrubbed:
 * the message, the exception values, the breadcrumbs, the request, the tags
 * and the extra context.
 */
export function beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // A user id is enough to count affected users and to find a report again;
  // an email or an IP is not needed for either.
  if (event.user) {
    const id = event.user.id;
    for (const key of USER_KEYS) {
      delete event.user[key];
    }
    event.user = id ? { id } : {};
  }

  if (event.message) {
    event.message = redact(event.message);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((entry) => ({
      ...entry,
      value: entry.value ? redact(entry.value) : entry.value,
    }));
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? redact(crumb.message) : crumb.message,
      data: crumb.data ? scrub(crumb.data) : crumb.data,
    }));
  }

  if (event.request) {
    // A URL can carry a row id or a filter in its query string.
    event.request = {
      ...event.request,
      url: event.request.url ? redact(event.request.url) : event.request.url,
      query_string: undefined,
      cookies: undefined,
      headers: undefined,
      data: event.request.data ? scrub(event.request.data) : undefined,
    };
  }

  event.extra = event.extra ? scrub(event.extra) : event.extra;
  event.contexts = event.contexts ? scrub(event.contexts) : event.contexts;

  return event;
}

/** Breadcrumbs are the most common accidental leak: they record everything. */
export function beforeBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  // A console breadcrumb is the developer's own `console.warn` - already
  // redacted by the logger, but it arrives here unstructured, so it is
  // dropped rather than trusted.
  if (crumb.category === 'console') {
    return null;
  }

  return {
    ...crumb,
    message: crumb.message ? redact(crumb.message) : crumb.message,
    data: crumb.data ? scrub(crumb.data) : crumb.data,
  };
}

let started = false;

/**
 * Starts reporting. Safe to call more than once; the second call is a no-op.
 */
export function initMonitoring(config: MonitoringConfig = readMonitoringConfig()): boolean {
  if (started || !config.enabled || !config.dsn) {
    return false;
  }
  started = true;

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    // `sendDefaultPii` off is the switch that stops the SDK attaching the
    // device's IP and the user's headers without being asked.
    sendDefaultPii: false,
    // A finance app's screens are its data. A screenshot or a view hierarchy
    // attached to a crash is a balance sheet attached to a crash.
    attachScreenshot: false,
    attachViewHierarchy: false,
    // Sampled rather than off: enough traces to see a slow query, few enough
    // to stay inside a free quota.
    tracesSampleRate: config.environment === 'production' ? 0.1 : 1,
    beforeSend,
    beforeBreadcrumb,
  });

  if (config.channel) {
    Sentry.setTag('update_channel', config.channel);
  }
  Sentry.setTag('variant', config.environment);

  return true;
}

/**
 * Ties reports to a user by id only.
 *
 * The id is a UUID that means nothing outside the user's own Supabase
 * project - which is enough to count affected users and to find their
 * reports again, and is not their identity.
 */
export function identifyUser(userId: string | null): void {
  if (!started) {
    return;
  }
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Reports a handled error - one the app recovered from but should not have. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!started) {
    return;
  }
  Sentry.captureException(error, context ? { extra: scrub(context) } : undefined);
}
