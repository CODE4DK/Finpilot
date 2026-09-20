# Maestro end-to-end flows

These drive the real app on a device or emulator, against a real Supabase
project. They are the layer the Jest suite cannot reach: the native keyboard,
the share sheet, the app switcher, and what actually happens when the radio is
off.

```bash
brew install maestro                      # or: curl -Ls "https://get.maestro.mobile.dev" | bash
npm run android                           # a development build must be installed
maestro test .maestro/                    # everything
maestro test .maestro/03-add-expense.yaml # one flow
maestro test --include-tags smoke .maestro/
```

The flows target the **development** variant (`com.code4dk.finpilot.dev`), so
they never touch a production install. Change `appId` at the top of each flow
to run them against preview or production.

## Before you run them

1. **A development build**, not Expo Go — FinPilot uses native modules.
2. **A throwaway account.** The flows create, edit and delete real rows, and
   `11-sign-out.yaml` signs out at the end.
3. **`MAESTRO_EMAIL` and `MAESTRO_OTP`** for the sign-in flow. Point them at a
   Supabase test user with a fixed OTP, or run `01-onboarding.yaml` by hand
   once and let the others reuse the session:

   ```bash
   maestro test -e MAESTRO_EMAIL=qa@example.com -e MAESTRO_OTP=123456 .maestro/
   ```

## What each flow covers

| Flow                        | Covers                                                  | Tag        |
| --------------------------- | ------------------------------------------------------- | ---------- |
| `01-onboarding.yaml`        | First run: sign in, name, first account, app lock offer | smoke      |
| `02-add-expense.yaml`       | The three-tap expense, and that it lands on Home        | smoke      |
| `03-add-transfer.yaml`      | A transfer nets to zero and is in neither total         | regression |
| `04-edit-transaction.yaml`  | Editing an amount and a category                        | regression |
| `05-delete-undo.yaml`       | Swipe to delete, then Undo restores the row             | regression |
| `06-budget-threshold.yaml`  | Create a budget, then spend past 80% of it              | regression |
| `07-goal-contribution.yaml` | Create a goal and fund it                               | regression |
| `08-offline-sync.yaml`      | Add with the radio off, then watch it sync              | smoke      |
| `09-reports.yaml`           | Period selector, donut, trend, category drill-down      | regression |
| `10-export-csv.yaml`        | CSV export reaches the share sheet                      | regression |
| `11-sign-out.yaml`          | Sign out clears the device                              | smoke      |

## The one that needs a real device

`08-offline-sync.yaml` toggles the radio through `adb`, so it is Android-only
as written. On iOS, run it by hand: enable aeroplane mode, add a transaction,
confirm the sync indicator says the change is saved on the device, then turn
the radio back on and watch it go green.

Offline is not a corner of this app — it is the premise. It is worth the
manual pass on both platforms before a release.
