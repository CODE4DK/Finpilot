import {
  beforeBreadcrumb,
  beforeSend,
  identifyUser,
  initMonitoring,
  readMonitoringConfig,
  reportError,
  scrub,
} from '@/lib/monitoring';

/**
 * A crash report is a log line that leaves the device, so these are the same
 * assertions as the logger's - held to a stricter standard, because the
 * destination is a third party rather than a developer's console.
 */

type ErrorEvent = Parameters<typeof beforeSend>[0];

const event = (overrides: Partial<ErrorEvent> = {}): ErrorEvent =>
  ({ event_id: 'abc', ...overrides }) as ErrorEvent;

describe('scrub', () => {
  it('removes anything keyed like money, whatever the value is', () => {
    const scrubbed = scrub({
      amount_paise: 500000,
      balance: 1234,
      limit_paise: 999,
      spent_paise: 1,
      category_name: 'Rent',
      note: 'loan to Ravi',
    });

    expect(Object.values(scrubbed)).toEqual(Array(6).fill('[redacted]'));
  });

  it('removes anything keyed like a person', () => {
    const scrubbed = scrub({ email: 'a@b.com', phone: '9876543210', full_name: 'Alice' });

    expect(Object.values(scrubbed)).toEqual(['[redacted]', '[redacted]', '[redacted]']);
  });

  it('removes anything keyed like a credential', () => {
    const scrubbed = scrub({ token: 'ey.x.y', password: 'hunter2', pin: '4821', hash: 'deadbeef' });

    expect(Object.values(scrubbed)).toEqual(Array(4).fill('[redacted]'));
  });

  it('keeps the keys that make a report useful', () => {
    const scrubbed = scrub({ screen: 'Reports', status: 429, table: 'transactions' });

    expect(scrubbed).toEqual({ screen: 'Reports', status: 429, table: 'transactions' });
  });

  it('still redacts a value that slipped into an innocent key', () => {
    // `reason` is not on the forbidden list, so the string redactor is what
    // catches this one.
    const scrubbed = scrub({ reason: 'failed for alice@example.com' });

    expect(scrubbed.reason).toBe('failed for [email]');
  });

  it('reaches into nested objects and arrays', () => {
    const scrubbed = scrub({
      rows: [{ amount_paise: 1 }, { note: 'x' }],
      meta: { email: 'a@b.c' },
    });

    expect(scrubbed).toEqual({
      rows: [{ amount_paise: '[redacted]' }, { note: '[redacted]' }],
      meta: { email: '[redacted]' },
    });
  });

  it('stops at a sane depth rather than following a cycle forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { amount: 1 } } } } } } } };

    expect(() => scrub(deep)).not.toThrow();
  });

  it('leaves null and undefined alone', () => {
    expect(scrub(null)).toBeNull();
    expect(scrub(undefined)).toBeUndefined();
  });
});

describe('beforeSend', () => {
  it('keeps the user id and drops everything else about them', () => {
    const sent = beforeSend(
      event({
        user: {
          id: 'a1111111-1111-4111-8111-111111111111',
          email: 'alice@example.com',
          ip_address: '203.0.113.4',
          username: 'alice',
        },
      }),
    );

    expect(sent!.user).toEqual({ id: 'a1111111-1111-4111-8111-111111111111' });
  });

  it('redacts the message', () => {
    const sent = beforeSend(event({ message: 'upload failed for alice@example.com' }));

    expect(sent!.message).toBe('upload failed for [email]');
  });

  it('redacts the exception value, which is where PostgREST quotes a row back', () => {
    const sent = beforeSend(
      event({
        exception: {
          values: [
            {
              type: 'Error',
              value: 'duplicate key (amount_paise)=(500000) on transactions',
            },
          ],
        },
      }),
    );

    expect(sent!.exception!.values![0]!.value).not.toContain('500000');
  });

  it('redacts breadcrumbs, which record everything by default', () => {
    const sent = beforeSend(
      event({
        breadcrumbs: [{ message: 'POST /rest/v1/transactions', data: { amount_paise: 500000 } }],
      }),
    );

    expect(sent!.breadcrumbs![0]!.data).toEqual({ amount_paise: '[redacted]' });
  });

  it('drops the query string, cookies and headers off a request', () => {
    const sent = beforeSend(
      event({
        request: {
          url: 'https://project.supabase.co/rest/v1/transactions?id=eq.abc',
          query_string: 'id=eq.abc',
          cookies: { session: 'secret' },
          headers: { Authorization: 'Bearer ey.x.y' },
        },
      }),
    );

    expect(sent!.request!.query_string).toBeUndefined();
    expect(sent!.request!.cookies).toBeUndefined();
    expect(sent!.request!.headers).toBeUndefined();
  });

  it('scrubs extra and contexts', () => {
    const sent = beforeSend(event({ extra: { balance: 1 }, contexts: { row: { note: 'x' } } }));

    expect(sent!.extra).toEqual({ balance: '[redacted]' });
    expect(sent!.contexts).toEqual({ row: { note: '[redacted]' } });
  });

  it('passes an event with nothing sensitive through unchanged', () => {
    const sent = beforeSend(event({ message: 'render failed in Reports' }));

    expect(sent!.message).toBe('render failed in Reports');
  });
});

describe('beforeBreadcrumb', () => {
  it('drops console breadcrumbs rather than trusting them', () => {
    expect(beforeBreadcrumb({ category: 'console', message: 'anything' })).toBeNull();
  });

  it('redacts the ones it keeps', () => {
    const crumb = beforeBreadcrumb({
      category: 'http',
      message: 'GET /profiles?email=alice@example.com',
      data: { amount: 500 },
    });

    expect(crumb!.message).not.toContain('alice@example.com');
    expect(crumb!.data).toEqual({ amount: '[redacted]' });
  });
});

describe('initMonitoring', () => {
  it('does nothing without a DSN, however the variant is configured', () => {
    expect(
      initMonitoring({
        environment: 'production',
        release: 'finpilot@1.0.0',
        enabled: true,
        dsn: undefined,
      }),
    ).toBe(false);
  });

  it('does nothing in a variant that has reporting turned off', () => {
    expect(
      initMonitoring({
        dsn: 'https://key@o1.ingest.sentry.io/1',
        environment: 'development',
        release: 'finpilot@1.0.0',
        enabled: false,
      }),
    ).toBe(false);
  });

  it('leaves identify and report as no-ops until it has started', () => {
    expect(() => identifyUser('user-1')).not.toThrow();
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });
});

describe('readMonitoringConfig', () => {
  it('reports a release name Sentry can match to a build', () => {
    expect(readMonitoringConfig().release).toMatch(/^finpilot@\d+\.\d+\.\d+/);
  });

  it('is disabled in a test run, which has no DSN', () => {
    expect(readMonitoringConfig().enabled).toBe(false);
  });
});
