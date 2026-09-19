# Auth

Sign-in, the session, and the route guard.

```
api.ts            Supabase calls: OTP, id_token exchange, profile, sign out
auth-gate.tsx     The single place navigation is enforced (mounted in app/_layout)
auth-store.ts     Zustand: session, user, profile, busy, pendingEmail
errors.ts         Supabase errors -> friendly, actionable copy
oauth.ts          Google and Apple native sign-in
routing.ts        resolveRedirect() - pure, unit tested
use-auth.ts       Session bootstrap, profile sync, signOutEverywhere()
use-resend-timer.ts
validation.ts     Email and OTP checks
```

Principles:

- **The gate decides, screens never navigate on sign-in.** A successful sign-in
  updates the session; `AuthGate` notices and redirects. Screens that try to
  `router.replace` as well cause double navigation.
- **Redirect order is lock → onboarding → app.** The lock wins, so an
  unlocked screen is never reachable mid-onboarding.
- **A null profile means "unknown", not "onboarding incomplete".** The guard
  holds position until it loads, otherwise an offline launch would push a
  returning user back through the wizard.
- **Errors never reach the user raw.** Everything goes through
  `toFriendlyAuthError`; a cancelled OAuth sheet is silent.

Setup steps for the providers are in [docs/AUTH_SETUP.md](../../../docs/AUTH_SETUP.md).
