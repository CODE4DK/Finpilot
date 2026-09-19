import {
  completeOnboarding,
  createFirstAccount,
  fetchProfile,
  sendEmailOtp,
  signInWithIdToken,
  signOut,
  verifyEmailOtp,
} from '@/features/auth/api';
import { makeProfile, makeSession, TEST_USER_ID } from '@/test-utils/supabase-mock';

/**
 * The auth API is a thin layer over supabase-js, and thin layers are where
 * mistakes hide: a forgotten `throw`, an unnormalised email, a session that
 * came back null but was treated as success. Each of those is asserted here
 * against a stub client rather than a live project.
 */

type Result = { data?: unknown; error?: unknown };

function stubClient(results: Record<string, Result> = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, args: unknown[]): Result => {
    calls[name] = args;
    return results[name] ?? { data: null, error: null };
  };

  // Explicitly typed: the object's methods return the object, which TypeScript
  // cannot infer without help.
  const table: Record<string, jest.Mock> = {
    select: jest.fn(() => table),
    eq: jest.fn((...args: unknown[]) => {
      record('eq', args);
      return table;
    }),
    is: jest.fn(() => table),
    maybeSingle: jest.fn(async () => results.select ?? { data: null, error: null }),
    single: jest.fn(async () => results.single ?? { data: null, error: null }),
    update: jest.fn((...args: unknown[]) => {
      record('update', args);
      return table;
    }),
    insert: jest.fn(async (...args: unknown[]) => {
      record('insert', args);
      return results.insert ?? { data: null, error: null };
    }),
  };

  return {
    calls,
    table,
    auth: {
      signInWithOtp: jest.fn(async (...args: unknown[]) => record('signInWithOtp', args)),
      verifyOtp: jest.fn(async (...args: unknown[]) => record('verifyOtp', args)),
      signInWithIdToken: jest.fn(async (...args: unknown[]) => record('signInWithIdToken', args)),
      signOut: jest.fn(async () => results.signOut ?? { error: null }),
    },
    from: jest.fn(() => table),
  };
}

type StubClient = ReturnType<typeof stubClient>;
const asClient = (client: StubClient) => client as never;

describe('sendEmailOtp', () => {
  it('normalises the address before it leaves the device', async () => {
    const client = stubClient();

    await sendEmailOtp('  Alice@EXAMPLE.com ', asClient(client));

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('throws what Supabase returned rather than swallowing it', async () => {
    const error = new Error('rate limited');
    const client = stubClient({ signInWithOtp: { error } });

    await expect(sendEmailOtp('a@b.com', asClient(client))).rejects.toThrow('rate limited');
  });
});

describe('verifyEmailOtp', () => {
  it('trims the code, which is easy to paste with a space', async () => {
    const session = makeSession();
    const client = stubClient({ verifyOtp: { data: { session }, error: null } });

    await expect(verifyEmailOtp('a@b.com', ' 123456 ', asClient(client))).resolves.toBe(session);
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      token: '123456',
      type: 'email',
    });
  });

  it('refuses a success with no session - a half sign-in is not a sign-in', async () => {
    const client = stubClient({ verifyOtp: { data: { session: null }, error: null } });

    await expect(verifyEmailOtp('a@b.com', '123456', asClient(client))).rejects.toThrow(
      /no session/i,
    );
  });

  it('propagates a wrong-code error', async () => {
    const client = stubClient({ verifyOtp: { error: new Error('Token has expired') } });

    await expect(verifyEmailOtp('a@b.com', '000000', asClient(client))).rejects.toThrow(
      'Token has expired',
    );
  });
});

describe('signInWithIdToken', () => {
  it('passes the provider, token and nonce straight through', async () => {
    const session = makeSession();
    const client = stubClient({ signInWithIdToken: { data: { session }, error: null } });

    await expect(signInWithIdToken('google', 'id-token', 'nonce', asClient(client))).resolves.toBe(
      session,
    );
    expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'id-token',
      nonce: 'nonce',
    });
  });

  it('refuses a success with no session', async () => {
    const client = stubClient({ signInWithIdToken: { data: { session: null }, error: null } });

    await expect(
      signInWithIdToken('apple', 'id-token', undefined, asClient(client)),
    ).rejects.toThrow(/no session/i);
  });
});

describe('fetchProfile', () => {
  it('returns the row for the user, excluding soft-deleted ones', async () => {
    const profile = makeProfile();
    const client = stubClient({ select: { data: profile, error: null } });

    await expect(fetchProfile(TEST_USER_ID, asClient(client))).resolves.toBe(profile);
    expect(client.table.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns null rather than throwing when there is no profile yet', async () => {
    const client = stubClient({ select: { data: null, error: null } });

    await expect(fetchProfile(TEST_USER_ID, asClient(client))).resolves.toBeNull();
  });

  it('throws a real error, so the caller can tell it from "no profile"', async () => {
    const client = stubClient({ select: { data: null, error: new Error('network') } });

    await expect(fetchProfile(TEST_USER_ID, asClient(client))).rejects.toThrow('network');
  });
});

describe('completeOnboarding', () => {
  it('trims the name and marks onboarding done', async () => {
    const profile = makeProfile();
    const client = stubClient({ single: { data: profile, error: null } });

    await completeOnboarding(
      TEST_USER_ID,
      { fullName: '  Alice  ', currency: 'INR' },
      asClient(client),
    );

    expect(client.table.update).toHaveBeenCalledWith({
      full_name: 'Alice',
      currency: 'INR',
      onboarding_completed: true,
    });
  });

  it('includes the timezone only when one was given', async () => {
    const client = stubClient({ single: { data: makeProfile(), error: null } });

    await completeOnboarding(
      TEST_USER_ID,
      { fullName: 'Alice', currency: 'INR', timezone: 'Asia/Kolkata' },
      asClient(client),
    );

    expect(client.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: 'Asia/Kolkata' }),
    );
  });

  it('throws when the update fails', async () => {
    const client = stubClient({ single: { data: null, error: new Error('denied') } });

    await expect(
      completeOnboarding(TEST_USER_ID, { fullName: 'Alice', currency: 'INR' }, asClient(client)),
    ).rejects.toThrow('denied');
  });
});

describe('createFirstAccount', () => {
  it('writes the client-supplied id, so a retry does not duplicate it', async () => {
    const client = stubClient();

    await createFirstAccount(
      TEST_USER_ID,
      { id: 'account-1', name: '  HDFC  ', type: 'bank', openingBalancePaise: 50000 },
      asClient(client),
    );

    expect(client.table.insert).toHaveBeenCalledWith({
      id: 'account-1',
      user_id: TEST_USER_ID,
      name: 'HDFC',
      type: 'bank',
      opening_balance_paise: 50000,
    });
  });

  it('throws when the insert fails', async () => {
    const client = stubClient({ insert: { error: new Error('constraint') } });

    await expect(
      createFirstAccount(
        TEST_USER_ID,
        { id: 'a', name: 'A', type: 'bank', openingBalancePaise: 0 },
        asClient(client),
      ),
    ).rejects.toThrow('constraint');
  });
});

describe('signOut', () => {
  it('resolves when Supabase does', async () => {
    const client = stubClient();

    await expect(signOut(asClient(client))).resolves.toBeUndefined();
  });

  it('throws when it does not', async () => {
    const client = stubClient({ signOut: { error: new Error('offline') } });

    await expect(signOut(asClient(client))).rejects.toThrow('offline');
  });
});
