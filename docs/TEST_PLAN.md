# Test plan

What FinPilot is tested for, at which level, and what a person still has to
check by hand before a release.

## The three levels

| Level              | Where              | What it is for                                                                         | How to run               |
| ------------------ | ------------------ | -------------------------------------------------------------------------------------- | ------------------------ |
| Unit and component | `src/**/__tests__` | Money maths, period boundaries, validation, the privacy boundary, every pure rule      | `npm test`               |
| Screen             | `app/__tests__`    | A whole screen against a fake database: what renders, what is written, what is refused | `npm test`               |
| End to end         | `.maestro/`        | The real app on a real device: the keyboard, the share sheet, the radio                | `maestro test .maestro/` |
| Database           | `supabase/tests`   | RLS, privileges, constraints, the delete order                                         | `npm run db:test`        |

Coverage for `src/features` and `src/utils` is enforced at **80%** on
statements, branches, functions and lines (`npm run test:coverage`); the suite
fails below it rather than reporting it. It currently sits at 93% / 86% / 93% /
94% for `src/features` and 100% / 97% / 100% / 100% for `src/utils`.

Coverage is a floor, not a goal. A line can be covered by a test that asserts
nothing; what these cases are written against is behaviour.

---

## Functional flows

| ID   | Scenario                     | Steps                                                                                                             | Expected                                                                                         | Priority |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| F-01 | First run                    | Install, open, sign in by email OTP, enter a name, add a first account with an opening balance, skip the app lock | Lands on Home; net worth equals the opening balance; one account exists                          | P0       |
| F-02 | Add an expense               | Add tab → type 450 → tap a category → Save                                                                        | Row appears on the list and in this month's spend; three taps after the amount                   | P0       |
| F-03 | Add income                   | Add tab → Income → amount → category → Save                                                                       | Counted in income, not expense; net worth rises                                                  | P0       |
| F-04 | Add a transfer               | Add tab → Transfer → amount → from and to → Save                                                                  | Nets to zero across the two accounts; appears in **neither** income nor expense                  | P0       |
| F-05 | Transfer to the same account | Pick the same account for both sides                                                                              | Save is refused with a reason; nothing is written                                                | P1       |
| F-06 | Edit a transaction           | Open a row, change the amount, Save changes                                                                       | New amount everywhere; the day total follows                                                     | P0       |
| F-07 | Delete with undo             | Swipe left → Delete → Undo                                                                                        | Row returns with its **original id**, so other devices see a restore rather than a twin          | P0       |
| F-08 | Delete for good              | Swipe → Delete, let the toast expire                                                                              | Row stays gone; `deleted_at` is stamped, the row is not removed                                  | P0       |
| F-09 | Search and filter            | Type in search; apply type, account and category filters                                                          | List narrows; filter count shown; clearing restores everything                                   | P1       |
| F-10 | Repeating transaction        | Save with Repeat monthly                                                                                          | A rule is created starting at the **next** occurrence; today's entry is the one just saved       | P1       |
| F-11 | Repeating catch-up           | Change the device date forward a month, reopen                                                                    | Missed occurrences are generated once, with deterministic ids                                    | P1       |
| F-12 | Create a budget              | Budgets → Set a budget → category → limit                                                                         | Bar shows spent against limit; days left and safe-per-day are shown                              | P0       |
| F-13 | Cross 80% of a budget        | Spend to 85% of a limit                                                                                           | Bar turns amber **and** the label says "85% used"; one notification, if alerts are on            | P0       |
| F-14 | Cross 100%                   | Spend past the limit                                                                                              | Bar turns red; a second alert; the over-budget count on the summary                              | P1       |
| F-15 | Copy last month's budgets    | Budgets → Copy last month's                                                                                       | Only categories without a budget this month are added; running twice adds nothing                | P2       |
| F-16 | Create a goal and fund it    | Goals → Create → name, target → Add contribution                                                                  | Ring and percentage update; required monthly saving shown                                        | P1       |
| F-17 | Reports                      | Reports → each period preset                                                                                      | Donut and trend render; the spoken summary names the totals; empty states where there is no data | P1       |
| F-18 | Category drill-down          | Reports → tap a category                                                                                          | Its transactions for the same period, with the period carried in the URL                         | P1       |
| F-19 | CSV export                   | Reports → Export CSV                                                                                              | Share sheet opens; the file is UTF-8 with a BOM, CRLF rows, plain rupee amounts                  | P1       |
| F-20 | Whole-archive export         | Settings → Export and delete → Export my data                                                                     | One JSON file with all nine tables, read from the device                                         | P2       |
| F-21 | AI insight                   | Opt in, Generate for this month                                                                                   | An insight is stored and shown with the AI badge; the payload carries no notes or account names  | P1       |
| F-22 | Insight fallback             | Generate while opted out or offline                                                                               | The on-device insight is shown instead, badged "On device"                                       | P1       |
| F-23 | App lock                     | Turn on, set a PIN, background the app past the timeout                                                           | Lock screen on return; correct PIN unlocks; wrong PINs count down                                | P0       |
| F-24 | App switcher                 | Background the app with the lock on                                                                               | Content is covered in the switcher on iOS and blanked on Android                                 | P0       |
| F-25 | Delete account               | Settings → Export and delete → type DELETE                                                                        | Every row and the auth user are removed; the device is left signed out and empty                 | P0       |
| F-26 | Sign out                     | Settings → Sign out                                                                                               | Session, local database, PIN and preferences all cleared; relaunch stays signed out              | P0       |
| F-27 | Theme                        | Settings → Appearance → Dark                                                                                      | Applies immediately and **survives a relaunch**                                                  | P1       |
| F-28 | Privacy mode                 | Toggle on Home                                                                                                    | Amounts replaced by dots; the screen reader says they are hidden rather than reading nothing     | P2       |

## Offline and sync

| ID   | Scenario                 | Steps                                                                                | Expected                                                                                 | Priority |
| ---- | ------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------- |
| S-01 | Add offline              | Aeroplane mode → add a transaction                                                   | Saved instantly and visible; the indicator says it is on this device only                | P0       |
| S-02 | Sync on reconnect        | Turn the radio back on                                                               | Queue drains; the indicator goes green; the row is on the server                         | P0       |
| S-03 | Edit offline, then sync  | Edit twice offline, reconnect                                                        | The last edit wins by client `updated_at`; no duplicate rows                             | P0       |
| S-04 | Delete offline           | Delete offline, reconnect                                                            | The server row is soft-deleted, not removed                                              | P0       |
| S-05 | Two devices, same row    | Edit the same transaction on two devices, both offline, reconnect in the other order | Last write wins by `updated_at`; the earlier write is skipped, not applied on top        | P1       |
| S-06 | Stale delete             | Delete on device A, edit later on device B, sync both                                | The newer edit survives the older delete                                                 | P1       |
| S-07 | Clock skew               | Set a device clock an hour ahead, write, sync                                        | The server clamps the client timestamp; a runaway clock cannot win every future conflict | P2       |
| S-08 | Offline first run        | Install and open with no connection                                                  | A clear message, not a spinner or a crash; sign-in is retried when there is a connection | P1       |
| S-09 | Long offline period      | A week of entries offline, then reconnect                                            | All sync; nothing is lost or duplicated; the queue does not block on one bad row         | P1       |
| S-10 | Permanent upload failure | Force a row the server rejects                                                       | It is logged and discarded so the queue keeps moving; the log carries no amounts         | P2       |

## Edge cases

| ID   | Scenario                       | Steps                                               | Expected                                                                                                                         | Priority |
| ---- | ------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-01 | Zero amount                    | Enter ₹0 and save                                   | Refused with a reason; the database would refuse it too (`amount_paise > 0`)                                                     | P0       |
| E-02 | Very large amount              | Hold a digit key to 20 digits                       | Refused as invalid — **not** a crash. This was a real bug: it threw from inside the keystroke handler until Phase 9              | P0       |
| E-03 | Amount at the limit            | Enter `MAX_AMOUNT_RUPEES`                           | Accepted and exact; integer paise all the way through                                                                            | P1       |
| E-04 | Fractional paise               | Enter 10.005                                        | Rounded half away from zero, to a whole paisa                                                                                    | P1       |
| E-05 | Indian grouping                | Enter 100000                                        | Displays as ₹1,00,000 — not ₹100,000 — even on a Hermes build with a trimmed ICU                                                 | P1       |
| E-06 | Negative opening balance       | Create a credit card at -2,500                      | Stored negative; net worth reflects it                                                                                           | P1       |
| E-07 | Month boundary                 | Add a transaction at 23:59 on the last of the month | Falls in that month's totals, not the next                                                                                       | P0       |
| E-08 | Year boundary                  | 31 December and 1 January                           | Separate months and separate years in reports; the 12-month window labels both years                                             | P1       |
| E-09 | 29–31 of the month             | A monthly rule on the 31st                          | Lands on the last day of a shorter month, and returns to the 31st afterwards                                                     | P0       |
| E-10 | Leap day                       | A yearly rule on 29 February                        | Falls on 28 February in a non-leap year                                                                                          | P2       |
| E-11 | Timezone change                | Fly IST → UTC, reopen                               | Day grouping follows the device; no transaction lands in two days or none. Covered by `npm run test:timezones` across four zones | P1       |
| E-12 | DST transition                 | A device in a zone with DST, over the change        | The 23- and 25-hour days still group cleanly; nothing is lost at an ambiguous hour                                               | P2       |
| E-13 | Empty states                   | A brand-new account                                 | Every tab has an honest empty state with a way forward — never a zero presented as data                                          | P1       |
| E-14 | Ten thousand transactions      | Seed via `/dev/seed`                                | List scrolls smoothly, paging 200 at a time; reports aggregate in SQL and stay responsive                                        | P1       |
| E-15 | Low storage                    | Fill the device, then write                         | The write fails visibly rather than silently; the app recovers when space is freed                                               | P2       |
| E-16 | Long text                      | A 120-character note, an 80-character account name  | Accepted to the database's limit, refused past it, and never truncated silently                                                  | P2       |
| E-17 | Devanagari and emoji           | Name a category "चाय ☕"                            | Stored, displayed and exported correctly; the CSV keeps its BOM so Excel does not mangle it                                      | P2       |
| E-18 | CSV formula injection          | A note of `=cmd\|'/c calc'!A1`                      | Exported prefixed with an apostrophe so a spreadsheet treats it as text                                                          | P0       |
| E-19 | Uncategorised spend            | Delete a category used by past transactions         | Those rows read "Uncategorised" rather than breaking the reports                                                                 | P1       |
| E-20 | Corrupt local records          | A malformed PIN record or preference blob           | Treated as absent; the app starts. A corrupt PIN never locks someone out of their own data                                       | P1       |
| E-21 | Wrong PIN, then force-quit     | Five wrong PINs, kill the app, reopen               | Still locked out — the counter survives the relaunch. This was a real bug until Phase 9                                          | P0       |
| E-22 | Notification permission denied | Turn on budget alerts, deny                         | The toggle goes back off and points at phone settings; no silent failure                                                         | P1       |
| E-23 | Rate-limited insights          | Generate six times in a day                         | The sixth is refused with a clear message; the on-device insight still works                                                     | P2       |

## Accessibility

| ID   | Scenario                      | Expected                                                                                                            | Priority |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| A-01 | Screen reader on every screen | Every interactive element is labelled; charts are announced as a sentence, not as an image                          | P0       |
| A-02 | Touch targets                 | Everything tappable is at least 44pt, directly or through hitSlop                                                   | P0       |
| A-03 | Dynamic type at maximum       | Layouts hold; dense controls cap the multiplier rather than turning scaling off                                     | P1       |
| A-04 | Contrast in both themes       | Every token pair clears WCAG AA — enforced by `src/theme/__tests__/contrast.test.ts`                                | P0       |
| A-05 | Colour is never alone         | Budget bands, insight severity and change arrows all carry a number or a word as well                               | P0       |
| A-06 | Colour-vision deficiency      | The chart palette separates under deuteranopia — which is why the trend bars are blue and orange, not green and red | P1       |

A-01 and A-03 are partly automated: `app/__tests__/accessibility-audit.test.tsx`
walks every screen on every run. What it cannot check is whether a label _reads_
well, so the manual pass with VoiceOver and TalkBack stays on the release list.

---

## Release regression checklist

Run before every store submission. The automated block is a gate; the manual
block is a person with a device.

### Automated — must be green

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage` (fails below the 80% floor)
- [ ] `npm run test:timezones` (IST, UTC, New York, Chatham)
- [ ] `npm run db:test` (RLS, privileges, constraints, delete order)
- [ ] `npm run format:check`
- [ ] `maestro test --include-tags smoke .maestro/` on Android
- [ ] `maestro test --include-tags smoke .maestro/` on iOS

### Manual — on a real device, both platforms

- [ ] **F-01** first run end to end on a clean install
- [ ] **S-01 / S-02** aeroplane mode: add, reconnect, watch it sync
- [ ] **F-23 / F-24** app lock, including the app switcher
- [ ] **F-19** CSV export opened in Excel **and** Google Sheets — the BOM and
      the Indian grouping are exactly what a desktop spreadsheet gets wrong
- [ ] **F-25** account deletion on a throwaway account, then confirm the rows
      are gone server-side
- [ ] **A-01** a screen-reader pass over Home, Add, Transactions, Budgets and
      Reports
- [ ] **A-03** largest dynamic type setting on the same five screens
- [ ] **E-14** seed 10,000 transactions and scroll the list hard
- [ ] Dark mode on every screen
- [ ] The privacy policy and terms links open and resolve

### Store submission

- [ ] Version and build number bumped
- [ ] The delete-account route is reachable without signing in support
- [ ] Privacy policy URL resolves and describes the AI feature
- [ ] The AI insights consent screen matches what the payload builder sends
- [ ] Screenshots regenerated if any screen changed

### Sign-off

A release needs the automated block green, the manual block walked, and any
P0 failure fixed rather than waived. A P1 may ship with a known-issue note; a
P2 may ship.
