# App lock

Biometrics with a 4-digit PIN fallback.

```
app-lock-store.ts  Zustand: locked, settings, attempts
biometrics.ts      expo-local-authentication wrapper
lock-policy.ts     When to lock - pure, unit tested
pin.ts             Salted, iterated SHA-256 hashing and attempt limits
privacy-cover.tsx  What the app switcher sees
storage.ts         Keychain/keystore access for the PIN and settings
use-app-lock.ts    AppState lifecycle, FLAG_SECURE on Android
```

On the PIN's threat model: a 4-digit PIN has 10,000 possibilities, so no hash
makes a stolen record safe from an offline sweep. The hash keeps the PIN out of
storage in the clear; the real protections are the keychain/keystore
(hardware-backed, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, excluded from backups) and
the five-attempt lockout, after which only signing in again gets you back.

Hiding content in the app switcher takes two mechanisms: iOS snapshots the last
frame, so `PrivacyCover` draws over the app whenever `AppState` is not
`active`; Android renders the recents thumbnail live, so `FLAG_SECURE` (via
expo-screen-capture) is what blanks it there.
