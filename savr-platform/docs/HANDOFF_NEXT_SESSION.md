# SAVR launch handoff — 2026-08-27

Canonical repo: `GooseyPrime/SAVR`. Product code only under `savr-platform/`.
Live web: https://www.savr.cam (308 from https://savr.cam) and https://savr-eta.vercel.app
Vercel project: `savr` / `prj_FZMDZzHr13xd5JeY4ucoKRqtngiZ` / team `team_ne195izCVxKLkrwqMfs9JNuY`
Package: `cam.savr.app`  Owner: Michael Brandon Lane / InTellMe / brandon@intellmeai.com

## Locked decisions

- Pricing: Basic $4.99 / $49.99, Pro $9.99 / $99.99, 5-day trial, no free tier.
- Live Stripe price IDs (InTellMe livemode `acct_1DwfWtJF6bibA8ne`):
  - Basic monthly `price_1TswjQJF6bibA8netYlk5tmj`
  - Basic yearly `price_1TswjTJF6bibA8neA5OQJgNB`
  - Pro monthly `price_1TswjWJF6bibA8nedzOe1gu2`
  - Pro yearly `price_1TswjaJF6bibA8ne2SIUE1bx`
- Pantry snapshot is multi-tool. Barcode is opportunistic, not required.
- Nutrition scales from pantry `SAVR_NUTRI:` notes onto recipe amounts, divided by servings, then diet caps per serving.
- Hero is the official static Cloudinary logo. Do not show “Production workspace”.
- Android-first Play submit. Do not start iOS submit. Do not change prices.

## Verified on this session

- Production deploy is main @ `458a66b` (PR #87) plus later wiring PR if merged.
- Homepage, pricing, privacy, terms, sign-in, FAQ return 200.
- Pricing copy matches locked amounts and 5-day trial. No free tier.
- Auth CTAs: Sign In / Get Started → `/sign-in` and `/sign-up`. Pricing trial CTA is auth-gated.
- `analyzePantrySnapshot` is the `/api/ai/analyze-image` path used by web `/upload` and mobile camera scan.
- `scaleRecipeNutrition` runs in `/api/ai/create-recipe`.
- Remaining code blocker fixed in the pantry-notes wiring PR: scan results now persist `notes` so recipe nutrition can read them.

## Owner-only leftovers

See `OWNER_COMMANDS.md` and `PLAY_CONSOLE_SUBMIT.md`. EAS projectId is still empty until `eas init`. iOS parked.
