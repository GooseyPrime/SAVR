# SAVR — Google Play submission pack

Everything needed for the Play Console session, in the order the Console asks
for it. Copy the values verbatim. Anything marked **YOU** cannot be done by an
agent — it needs your account or your judgement.

- Package: `com.savr.app`
- Expo project: `@intellme/savr` (`acf58b96-e2fd-4d00-b289-e0686d13875c`)
- Build profile: `production` → Android App Bundle, remote version codes
- Artwork: `icon-512.png` and `feature-graphic-1024x500.png` in this folder

---

## 0. Account reality check

Your Play developer account is **personal**, not an organization. That means
Google requires a closed test with **at least 12 testers opted in continuously
for 14 days** before it will grant production access. The clock starts when the
12th tester opts in, and drops below 12 reset it — recruit 15–18 for buffer.

Practical sequence:

1. Internal testing (today) — up to 100 testers, no waiting period, for your own
   verification.
2. Closed testing (start today) — this is the track the 14-day clock counts.
3. Production (day 15+) — after the access questionnaire is approved.

Converting to an organization account with a D-U-N-S number removes the
requirement entirely. If InTellMe can produce a D-U-N-S number quickly, that
decision is worth more than any other item in this document.

---

## 1. Create the app — **YOU**

Play Console → **Create app**

| Field | Value |
|---|---|
| App name | `SAVR` |
| Default language | English (United States) |
| App or game | App |
| Free or paid | **Free** |
| Declarations | Tick both (developer program policies, US export laws) |

"Free" is correct even though SAVR has paid plans: nothing is purchased inside
the Android app. Subscriptions are sold on savr.cam. Marking it Paid would mean
a price on the Play listing itself, which is not what happens.

---

## 2. Store listing

**App name** (30 char max)

```
SAVR
```

**Short description** (80 char max — currently 74)

```
Scan your pantry, cut food waste, and cook what you already have at home.
```

**Full description** (4000 char max)

```
SAVR turns the food you already own into meals you actually want to eat.

Point your camera at a shelf, a fridge drawer, or a grocery receipt, and SAVR
builds your pantry for you — no typing item names one at a time. From there it
suggests recipes you can cook right now, tells you what you are missing, and
keeps track of what gets used up.

WHAT SAVR DOES

Scan your pantry
Photograph what you have and SAVR identifies items and adds them to your
inventory. Scan a receipt after a shop and the whole trip goes in at once.

Cook what you already have
Recipe suggestions are built from your actual inventory, so you stop buying a
fourth jar of cumin and start using the three you own.

Plan meals without the spreadsheet
Build a week of meals around what is already in the house, and let SAVR fill
the gaps with a grocery list that only contains things you genuinely need.

Waste less
Track what you have, see what needs using, and stop discovering the spinach a
week too late.

Cook with guidance
Step-by-step cooking mode with timers, so you are not scrolling with wet hands.

AI Chef (Pro)
Ask for substitutions, scale a recipe, adapt a dish to what is in the cupboard,
or get help with a technique.

PLANS

SAVR Basic and SAVR Pro are managed on savr.cam. Sign in with the same account
on your phone and your plan comes with you. There is nothing to buy inside this
app.

Every plan starts with a five-day free trial.

ABOUT YOUR DATA

SAVR uses your camera only to identify food items you photograph. Images are
processed to recognise items and are not sold or used for advertising. Your
account and inventory are stored securely and you can delete your account at
any time.

Questions: support@savr.cam
Privacy policy: https://savr.cam/privacy
Terms: https://savr.cam/terms
```

**Graphics**

| Asset | File | Notes |
|---|---|---|
| App icon | `icon-512.png` | 512×512, opaque, no alpha |
| Feature graphic | `feature-graphic-1024x500.png` | 1024×500 |
| Phone screenshots | **needed — see §7** | 2 minimum, 8 max |

**Categorisation**

| Field | Value |
|---|---|
| App category | Food & Drink |
| Tags | Recipes, Cooking, Meal planning |
| Contact email | `support@savr.cam` |
| Contact website | `https://savr.cam` |
| Privacy policy | `https://savr.cam/privacy` |

---

## 3. App access — the item most submissions fail on

SAVR requires sign-in, and its best features sit behind a Pro plan. A reviewer
who cannot get past the login screen, or who sees "Included with Pro" on every
interesting screen, will reject the app as broken or incomplete.

Play Console → **App content → App access → All or some functionality is restricted**

Add one instruction entry:

| Field | Value |
|---|---|
| Name | Full app access — demo account |
| Username | `playreview@savr.cam` (create this) |
| Password | *(set one and paste it here)* |
| Any other instructions | See block below |

```
SAVR requires an account. Sign in on the first screen with the credentials
above. This account has an active Pro subscription, so every feature is
available, including AI Chef.

Subscriptions are not sold inside this app. They are purchased on our website
at savr.cam. The app only reads the plan attached to the signed-in account.

To test pantry scanning, tap Scan and photograph any food item or grocery
receipt. A printed photo of food on a screen also works.
```

**YOU — create that account before submitting:**

1. Sign up at savr.cam with `playreview@savr.cam`.
2. Subscribe to Pro applying coupon `GOOSE7`, so the reviewer account is a real
   Pro account at no cost and no card is stored.
3. Confirm on `/subscription-debug` that the account reads `status: active` (or
   `trialing`) and `tier: pro` **before** submitting.

That last check is not optional. If the webhook has not written entitlement, the
reviewer sees a Basic account and the Pro features look broken.

---

## 4. Data safety

Play Console → **App content → Data safety**. These answers reflect what the app
actually does; do not soften them.

**Does your app collect or share any of the required user data types?** — Yes
**Is all user data encrypted in transit?** — Yes
**Do you provide a way for users to request deletion?** — Yes (`https://savr.cam/settings`)

| Data type | Collected | Shared | Purpose | Required? |
|---|---|---|---|---|
| Email address | Yes | No | Account management | Required |
| User IDs | Yes | No | Account management, app functionality | Required |
| Photos | Yes | **Yes** | App functionality (food recognition) | Optional |
| Other user-generated content (pantry items, recipes, meal plans, notes) | Yes | **Yes** | App functionality, personalisation | Required |
| App interactions | Yes | No | Analytics | Optional |
| Purchase history | Yes | No | App functionality (plan entitlement) | Required |

**Why Photos and user content are marked shared:** images and recipe/inventory
text are sent to third-party AI providers for processing. Google treats
transfer to a third party as sharing even when it is a processor acting on your
behalf. Declaring "not shared" here is a common cause of enforcement action.

For each shared type, purpose is **App functionality** only — not advertising,
not personalisation by a third party.

**Data is not:** used for advertising or marketing, sold to third parties, used
for credit scoring, or transferred for any purpose beyond providing the feature
the user invoked.

---

## 5. Remaining App content declarations

| Section | Answer |
|---|---|
| Privacy policy | `https://savr.cam/privacy` |
| Ads | **No**, this app contains no ads |
| Content rating | Questionnaire — see below |
| Target audience | 18 and over |
| Appeal to children | No |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | §4 above |
| Government apps | No |
| Financial features | **No** — no in-app purchases, no payments, no lending |
| Health apps | **No** — SAVR is not a medical or health-tracking app |

**Content rating questionnaire** — category **Utility, Productivity,
Communication, Other**, then answer **No** to every question: violence, sexual
content, profanity, controlled substances, gambling, simulated gambling, user
interaction, sharing location, digital purchases, unrestricted internet access.

Two that trip people up:

- **User interaction: No.** SAVR has no user-to-user messaging. AI Chef is the
  user talking to a model, not to other people.
- **Digital purchases: No.** Nothing is purchased inside the Android app.

Expected result: **Everyone**.

On target audience: selecting 18+ keeps SAVR out of the Families programme and
its extra requirements. It does not restrict who can install the app.

---

## 6. Google Play Billing — the policy position

SAVR sells subscriptions on the web through Stripe. Google requires Google Play
Billing for anything purchased *inside* an app, and forbids steering users to an
outside purchase flow unless you are enrolled in the US external-links or
alternative-billing programmes.

The position taken for this release is the conservative one: **the Android app
sells nothing and links to nothing purchasable.** It reads the plan on the
signed-in account and shows plan state as information only. PR #113 removed
every "Upgrade to Pro" affordance for exactly this reason.

Keep it that way. Before any future release, confirm no screen contains a
purchase control, a price, or a link to `savr.cam/pricing`. Adding one without
enrolling in the external-links programme puts the listing at risk.

---

## 7. Screenshots — **YOU**, 30 minutes

Play requires 2–8 phone screenshots, minimum 1080px on the long edge. Take them
from the internal-testing build on a real device so they show real data.

Suggested set, in listing order:

1. **Pantry / inventory** — a populated pantry. This is the product.
2. **Scan in progress** — camera pointed at food, items being recognised.
3. **Recipe suggestions** — recipes derived from that pantry.
4. **Recipe detail / cooking mode** — steps and timers.
5. **Meal plan** — a filled week.
6. **Grocery list** — generated from the plan.

Rules that get listings rejected: no device frames with fake bezels around a
different aspect ratio, no screenshots that are mostly marketing copy, no empty
states, and nothing showing another person's real data. Populate the demo
account with a realistic pantry first.

Optional but worthwhile: 7-inch and 10-inch tablet screenshots. Without them the
listing shows a "not optimised for tablets" note.

---

## 8. Signing, uploading, and automated submission

**App signing.** Opt into Play App Signing (the default). EAS already generated
and holds the upload key — it was created during the first build and lives in
Expo's credential store. Do not generate a second keystore anywhere; losing key
continuity means never being able to update the app under this package name.

**First upload — do it by hand.** Play Console → Testing → Internal testing →
Create release → upload the `.aab` from the build page. Automated submission
cannot run until the app record exists and has accepted a release.

**After that, automate it.** Create a Google Cloud service account, grant it
release permissions in Play Console → Users and permissions, download the JSON
key, and store it outside the repo. Then add to `eas.json`:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "../../secrets/google-play-service-account.json",
      "track": "internal",
      "releaseStatus": "draft"
    }
  }
}
```

and submit with `eas submit --platform android --profile production`.

Change `track` to `production` only after closed testing is cleared.

---

## 9. Pre-submission checklist

Verify on a real device against the internal-testing build:

- [ ] App installs and opens; icon is the SAVR mark, not a grey placeholder
- [ ] Sign-up and sign-in work against production Supabase
- [ ] `playreview@savr.cam` reads Pro on `/subscription-debug`
- [ ] Camera permission prompt appears with the SAVR wording and scanning works
- [ ] Recipes, meal plans, and grocery lists load real data
- [ ] AI Chef opens for the Pro account and is gated for a Basic account
- [ ] No screen shows a price, a purchase button, or a link to pricing
- [ ] Every menu row does something when tapped
- [ ] Google sign-in returns to the app (deep link `savr://auth/callback`)
- [ ] Sign-out works and returns to the login screen

Verify on the web before submitting, because the app depends on it:

- [ ] A real paid checkout completes and writes `active` + correct tier
- [ ] Stripe webhooks return 200 in the Stripe dashboard
- [ ] `/subscription-debug` reports billing configuration healthy

---

## 10. Known gaps carried into this release

Recorded so they are decisions rather than surprises:

- **Account deletion** is available on the website, not in the app. Google
  accepts a web path, but an in-app route is stronger and will eventually be
  expected.
- **No tablet-specific layouts.** The app runs on tablets; it is not optimised
  for them.
- **No mobile test suite.** `savr-platform/mobile` has no unit tests. Mobile
  regressions are currently caught only by typecheck and manual testing.
- **iOS is not started.** `eas.json` is Android-only by design; the iOS submit
  block was removed until an Apple Developer account exists.
