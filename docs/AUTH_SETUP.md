# Auth setup

Every console step needed to make sign-in work. Nothing here is a secret that
belongs in the repo: the Google client IDs and the Supabase anon key are public
identifiers. The values that _are_ secret (Google client secret, Apple private
key) are pasted into the Supabase dashboard and never into this codebase.

Work through the sections in order. Email OTP alone is enough to use the app —
Google and Apple can wait.

---

## 0. What you need first

- A Supabase project (Phase 2's migrations applied: `npx supabase db push`).
- The app's bundle identifier / package name, both `com.finpilot.app`
  (`app.json` → `expo.ios.bundleIdentifier` and `expo.android.package`).
- The app scheme, `finpilot` (`app.json` → `expo.scheme`).
- Your Supabase project ref — the `xxxx` in `https://xxxx.supabase.co`.

Fill these into `.env` as you go (copy from `.env.example`).

---

## 1. Supabase — email OTP

Dashboard → **Authentication → Sign In / Providers**.

1. **Email** provider → enable.
2. Turn **Confirm email** ON (it is the default).
3. Turn **Secure email change** ON.
4. Set **OTP expiry** to `3600` seconds or less. Supabase warns above that.
5. Leave **Enable email signups** ON — FinPilot has no separate sign-up screen;
   the same code both creates and signs in a user.

### Make the email send a code, not a link

This is the step people miss. By default the magic-link template sends a URL,
and the app asks for six digits.

Dashboard → **Authentication → Emails → Magic Link** template, and make sure
the body contains the token:

```html
<h2>Your FinPilot code</h2>
<p>Enter this code in the app:</p>
<p style="font-size: 28px; letter-spacing: 4px;"><strong>{{ .Token }}</strong></p>
<p>It expires in 60 minutes. If you didn't ask for it, ignore this email.</p>
```

`{{ .Token }}` is the 6-digit code. If you leave `{{ .ConfirmationURL }}` in
the template as well, users will tap the link instead of typing the code and
end up in a browser — remove it.

### Rate limits

Dashboard → **Authentication → Rate Limits**. The default is 2 emails/hour on
the built-in SMTP, which you will hit within minutes of testing. Either:

- set up custom SMTP (below), or
- accept it, and use a different address each time you test.

### Custom SMTP (strongly recommended before any real user)

Dashboard → **Project Settings → Authentication → SMTP Settings**. Supabase's
built-in sender is for development only and is aggressively rate limited. Use
Resend, Postmark, SES or similar:

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Sender email | `no-reply@yourdomain.com` (verified)   |
| Sender name  | `FinPilot`                             |
| Host / Port  | from your provider (587 with STARTTLS) |
| Username     | from your provider                     |
| Password     | from your provider — stays in Supabase |

Then raise the email rate limit under **Rate Limits**.

---

## 2. Supabase — redirect URLs

Dashboard → **Authentication → URL Configuration**.

- **Site URL**: `finpilot://`
- **Redirect URLs** — add each of these on its own line:

```
finpilot://
finpilot://auth/callback
exp://127.0.0.1:8081
exp://localhost:8081
https://auth.expo.io/@<your-expo-username>/finpilot
```

The two `exp://` entries let a development build talk to a local Metro server.
The `auth.expo.io` entry is only needed if you use Expo's auth proxy; native
Google/Apple sign-in as implemented here does not, but adding it costs nothing
and saves a confusing afternoon later.

---

## 3. Google sign-in

Google needs **three** OAuth client IDs. This trips everyone up: the _Web_
client is the one Supabase verifies tokens against, even though no web app
exists.

### 3a. Google Cloud Console — project and consent screen

1. <https://console.cloud.google.com> → create a project (or pick one).
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name `FinPilot`, your support email, developer contact email.
   - Scopes: add `openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile`. Nothing else — extra scopes trigger review.
   - Test users: add your own Google account while the app is in Testing.
3. Publish later; Testing mode is fine for development.

### 3b. Web client (required, even for a mobile-only app)

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Name: `FinPilot Web`
- **Authorised redirect URIs**:
  `https://<your-project-ref>.supabase.co/auth/v1/callback`

Copy the **Client ID** and **Client secret**.

### 3c. iOS client

**Create credentials → OAuth client ID**

- Application type: **iOS**
- Bundle ID: `com.finpilot.app`

Copy the Client ID. There is no secret for iOS clients.

### 3d. Android client

**Create credentials → OAuth client ID**

- Application type: **Android**
- Package name: `com.finpilot.app`
- SHA-1 certificate fingerprint — get it from the credentials EAS uses:

  ```bash
  npx eas credentials --platform android
  # Android → your profile → Keystore → shows the SHA-1
  ```

  For a local debug build instead:

  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore \
    -alias androiddebugkey -storepass android -keypass android
  ```

Add a **separate Android client for every keystore** you use — debug,
development, preview and production builds are signed differently, and a
mismatched SHA-1 fails with a bare "developer error" and no explanation.

### 3e. Tell Supabase

Dashboard → **Authentication → Sign In / Providers → Google** → enable.

- **Client ID**: the _Web_ client ID from 3b.
- **Client Secret**: the _Web_ client secret from 3b.
- **Authorized Client IDs**: the **iOS** and **Android** client IDs,
  comma-separated. This is what lets Supabase accept the id_token the native
  sheet returns.

### 3f. Tell the app

In `.env`:

```bash
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Android client id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Web client id>.apps.googleusercontent.com
```

Leave a platform blank and the Google button is simply unavailable there —
the app degrades rather than crashing.

---

## 4. Apple sign-in (iOS only)

Apple requires a paid Developer Program membership. **If your app offers any
third-party sign-in on iOS, App Review requires Sign in with Apple too** — so
this is not optional once Google is shipped on iOS.

### 4a. App ID

<https://developer.apple.com/account> → **Certificates, Identifiers & Profiles
→ Identifiers**

1. Register an **App ID** (or edit yours) with bundle ID `com.finpilot.app`.
2. Tick the **Sign in with Apple** capability. Save.

### 4b. Services ID

Supabase needs a Services ID as the OAuth audience.

1. **Identifiers → + → Services IDs**
2. Description `FinPilot Auth`, identifier `com.finpilot.app.auth`.
3. Enable **Sign in with Apple** → **Configure**:
   - Primary App ID: `com.finpilot.app`
   - Domains: `<your-project-ref>.supabase.co`
   - Return URLs: `https://<your-project-ref>.supabase.co/auth/v1/callback`

### 4c. Key

1. **Keys → + →** name it `FinPilot Sign in with Apple`.
2. Tick **Sign in with Apple**, Configure → primary App ID `com.finpilot.app`.
3. Register, then **download the `.p8` file** — Apple lets you download it
   exactly once. Note the **Key ID** and your **Team ID** (top right of the
   developer portal).

### 4d. Tell Supabase

Dashboard → **Authentication → Sign In / Providers → Apple** → enable.

| Field                  | Value                                              |
| ---------------------- | -------------------------------------------------- |
| Client IDs             | `com.finpilot.app` **and** `com.finpilot.app.auth` |
| Secret Key (for OAuth) | contents of the `.p8` file                         |
| Team ID                | your 10-character Team ID                          |
| Key ID                 | the Key ID from 4c                                 |

The native sheet returns an id_token whose audience is the **bundle ID**, so
`com.finpilot.app` must be in the Client IDs list — not only the Services ID.

### 4e. App config

Already set in `app.json`: `expo.ios.usesAppleSignIn: true` and the
`expo-apple-authentication` plugin. A new development build is required after
this change.

---

## 5. Build and run

Native modules were added this phase (secure store, local authentication,
Apple authentication, screen capture), so **Expo Go will no longer run the
app** and the previous development build is stale:

```bash
npx eas build --profile development --platform android   # or ios
# install the build, then:
npm start
```

---

## 6. Verify each path

| Path         | How to check                                                                     |
| ------------ | -------------------------------------------------------------------------------- |
| Email OTP    | Enter your address → check the inbox shows **six digits**, not a link → enter it |
| Wrong code   | Type `000000` → "That code is not right."                                        |
| Expired code | Wait past the OTP expiry, then submit → "That code has expired."                 |
| Rate limit   | Request several codes quickly → "Too many attempts."                             |
| Offline      | Turn on airplane mode → "Cannot reach FinPilot right now."                       |
| Google       | Tap Continue with Google → account picker → lands in the app                     |
| Cancelled    | Open the Google sheet and dismiss it → no error toast at all                     |
| Apple        | iOS device only; the simulator needs an iCloud account signed in                 |

After the first successful sign-in you should land in onboarding, and
`select * from profiles` in the SQL editor should show your row with
`onboarding_completed = false` plus 17 seeded categories.

---

## 7. Troubleshooting

**"Unsupported provider: provider is not enabled"** — the provider is off in
Supabase, or you enabled it in a different project than the one
`EXPO_PUBLIC_SUPABASE_URL` points at.

**Google returns "developer error" on Android** — the SHA-1 of the keystore
that signed the running build is not on any Android OAuth client. Each build
profile can use a different keystore.

**Apple sign-in fails with "invalid_client"** — the bundle ID is missing from
the Client IDs field in Supabase (4d), or the Services ID's return URL does not
exactly match your project's callback.

**The email contains a link instead of a code** — the Magic Link template still
has `{{ .ConfirmationURL }}`; see section 1.

**"Email rate limit exceeded" while testing** — built-in SMTP allows a couple
of emails per hour. Configure custom SMTP.

**Signed in but stuck on a blank screen** — the profile row failed to load.
Check the Phase 2 trigger ran: `select * from profiles where id = '<user id>'`.
If it is missing, the `on_auth_user_created` trigger is not installed on that
project.

**The app locks immediately every time** — that is the design: the lock engages
on cold start and after one minute in the background. Turn it off in
**Settings → Security**.
