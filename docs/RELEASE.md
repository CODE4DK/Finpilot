# Release runbook

How a change gets from a branch to a phone, and what to do when one goes
wrong.

## The shape of it

| Trigger         | What happens                                                                      | Who is affected                          |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| Pull request    | Lint, typecheck, tests with the coverage floor, the timezone suite, the SQL suite | Nobody - it is a gate                    |
| Push to `main`  | CI, then an EAS **preview** build (APK + TestFlight)                              | Internal testers                         |
| Tag `v*`        | CI again, then an EAS **production** build, then a **draft** store submission     | Everyone, once a human presses publish   |
| Manual dispatch | An OTA JavaScript update to `preview` or `production`                             | Everyone on that channel, within minutes |

Nothing releases itself. The tag is the decision, and both stores receive a
draft - an automated push to production is one bad tag away from an incident,
and this app holds people's money.

## The three environments

|             | Variant       | Bundle id                      | Channel       | Supabase         |
| ----------- | ------------- | ------------------------------ | ------------- | ---------------- |
| Development | `development` | `com.code4dk.finpilot.dev`     | `development` | Local or staging |
| Preview     | `preview`     | `com.code4dk.finpilot.preview` | `preview`     | **Staging**      |
| Production  | `production`  | `com.code4dk.finpilot`         | `production`  | **Production**   |

Different bundle ids mean all three install side by side on one device, which
is what makes "does this reproduce on the preview build?" a question someone
can answer in a minute.

Staging and production are **separate Supabase projects**. A tester's entry
must never reach a real ledger, and a migration has to be survivable before it
is irreversible.

### Setting the environment variables

They live on EAS, per environment, not in the repository:

```bash
eas env:create --environment preview \
  --name EXPO_PUBLIC_SUPABASE_URL --value https://staging-ref.supabase.co --visibility plaintext
eas env:create --environment preview \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <staging anon key> --visibility sensitive
eas env:create --environment preview \
  --name EXPO_PUBLIC_POWERSYNC_URL --value https://staging.powersync.journeyapps.com --visibility plaintext
eas env:create --environment preview \
  --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --visibility plaintext

# ...and the same four for --environment production, pointing at the
# production project.

# Build-time only, never in the bundle:
eas env:create --environment production \
  --name SENTRY_AUTH_TOKEN --value <token> --visibility secret
```

`eas env:list --environment production` before a release is worth the ten
seconds. A production build pointed at staging is the kind of mistake that
looks fine until someone's data is missing.

### GitHub secrets and variables

| Name                | Kind     | What it is                                      |
| ------------------- | -------- | ----------------------------------------------- |
| `EXPO_TOKEN`        | Secret   | An EAS robot token with build and update access |
| `SENTRY_AUTH_TOKEN` | Secret   | Uploads source maps at build time               |
| `SENTRY_ORG`        | Variable | Sentry organisation slug                        |
| `SENTRY_PROJECT`    | Variable | Sentry project slug                             |

## First-time setup

```bash
npm i -g eas-cli
eas login
eas init                 # writes the project id; the update URL derives from it
eas update:configure
eas credentials          # signing keys, once per platform
```

Then the environment variables above, then a first build of each profile.

---

## Cutting a release

### 1. Before you tag

- [ ] `main` is green: CI passed on the commit you are about to tag
- [ ] A preview build of that commit has been installed and walked through
      the manual checklist in [TEST_PLAN.md](./TEST_PLAN.md)
- [ ] `docs/CHANGELOG.md` has an entry for this version
- [ ] `version` in `app.config.ts` is the version you are about to tag - the
      workflow checks this, but finding out here is faster
- [ ] Any migration this release needs has been applied to **staging** and
      exercised, and the production migration is ready (`supabase db push`)

### 2. Tag it

```bash
git switch main && git pull
git tag -a v1.1.0 -m "v1.1.0"
git push origin v1.1.0
```

That starts `build-production.yml`: it re-runs the gate against the tagged
commit, builds both platforms on EAS, submits a draft to each store, and
opens a draft GitHub release from the changelog section.

### 3. While it builds

- [ ] Apply the production migration, if there is one. **Migrations go before
      the build reaches users, not after** - an app expecting a column that is
      not there is an outage, while a column nothing reads yet is harmless.
- [ ] Check the Sentry release appeared with its source maps attached

### 4. Ship it

- [ ] App Store Connect: check the build, fill in what is new, submit
- [ ] Play Console: promote the draft from internal to production, staged at
      20% for the first day
- [ ] Publish the GitHub release
- [ ] Watch Sentry for the first hour: a spike in a new release is what a
      rollback is for

### 5. After

- [ ] Bump `version` in `app.config.ts` to the next version on `main`
- [ ] Note anything the runbook got wrong, here, while it is fresh

---

## Over-the-air updates

An OTA update replaces the **JavaScript** on installed builds within minutes,
without store review. Run the `OTA update` workflow, pick a channel, and say
why.

### What it can and cannot fix

| Can                                                   | Cannot                                               |
| ----------------------------------------------------- | ---------------------------------------------------- |
| A wrong label, a bad calculation, a crash in a screen | Anything native: a new module, a permission, an icon |
| A missed edge case in a pure function                 | A change to `app.config.ts`                          |
| Copy, formatting, a validation bound                  | An SDK upgrade                                       |

The runtime version policy is `appVersion` (`app.config.ts`), so an update is
only offered to builds compiled against the same marketing version. That is
the conservative choice: a native change means a store release, and the
alternative - `fingerprint` - makes "can this update reach that build?" a
question only a tool can answer, which is the worst time to need one.

**So: bump the version in `app.config.ts` only when you cut a store release.**
Bumping it mid-cycle strands every installed build on an old runtime version
and silently cuts them off from patches.

### Rolling one back

```bash
eas update:list --branch production          # find the good update's id
eas update:republish --group <group-id>      # push it back out
```

Republishing is faster than reverting the code and cutting a new update, and
it is what you want at 2am. Fix the code properly afterwards.

---

## When something is wrong in production

**Work out which layer it is first.** The answer decides everything else.

| Symptom                                  | Layer      | Fix                                                          |
| ---------------------------------------- | ---------- | ------------------------------------------------------------ |
| A crash or wrong number in a screen      | JavaScript | OTA update                                                   |
| A native crash, a permission, an SDK bug | Native     | Store release, expedited if it is bad                        |
| Wrong data or a broken policy            | Database   | Migration, immediately - it affects every client at once     |
| Sync stalled or a queue blocked          | PowerSync  | Check the dashboard and the connector's discarded-upload log |

### An OTA hotfix

1. Branch from the **tag**, not from `main` - `main` may contain work that is
   not ready to go out to everyone in five minutes.
2. Fix it, with a test that fails without the fix.
3. Merge to `main`, then run the `OTA update` workflow against `production`
   with a message saying what broke.
4. Confirm in Sentry that the error rate drops on the new update.

### Rolling back a store release

There is no unpublish. What you have is:

- **Play**: halt the staged rollout. This is why the first day is 20%.
- **App Store**: remove the version from sale, then expedite a fix. Slow.
- **Either**: an OTA update that neutralises the bad code, if it is
  JavaScript. Usually the fastest real remedy.

---

## Monitoring

Sentry is on for preview and production builds only - a developer watching a
stack trace in Metro does not need it twice, and that noise is what makes a
real release's issues easy to miss.

Every report is tagged with the environment, the update channel and the
release (`finpilot@1.0.0+<runtime>`), so "is this the OTA or the build?" is
answerable from the issue page.

**What Sentry never receives**, enforced in `src/lib/monitoring.ts` and tested
in `src/lib/__tests__/monitoring.test.ts`: amounts, balances, limits, notes,
category and account names, emails, phone numbers, tokens, PINs. The user is
a bare UUID. Screenshots and view hierarchies are off, because in this app a
screenshot **is** the data.

### What to watch after a release

| Signal                           | Healthy               | Act when                                                |
| -------------------------------- | --------------------- | ------------------------------------------------------- |
| Crash-free sessions              | > 99.5%               | Below 99% - roll back or hotfix                         |
| New issues in the release        | A handful, low volume | One issue with a steep curve                            |
| Sync errors (`[powersync]` tags) | Rare                  | A sustained rise - check PowerSync and the server       |
| Edge Function errors             | Near zero             | Any sustained rate; check the `ai_insight_requests` log |

---

## Troubleshooting the pipeline

**The build fails with a missing environment variable.** `readEnv` throws when
one of the three is absent. Check `eas env:list --environment <name>`; CI
supplies placeholders for the same reason.

**Source maps are missing from a Sentry release.** `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG` and `SENTRY_PROJECT` all have to be present at build time. The
build succeeds without them - it just uploads nothing, which you only notice
when a stack trace is unreadable.

**An update does not reach a device.** Check the channel (`eas channel:view
production`) and the runtime version. A build on 1.0.0 will not accept an
update published from 1.1.0, by design.

**The tag check fails.** The tag and `version` in `app.config.ts` disagree.
Fix the version, delete the tag, tag again - do not force the check.
