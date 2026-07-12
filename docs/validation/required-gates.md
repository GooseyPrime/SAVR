# Required Validation Gates

This file records the exact commands that are already available in `SAVR-old/` and the gaps that future work must close.

## Available commands and direct validations

| Area | Exact command currently available from the repository | Status | Evidence |
|---|---|---|---|
| Web dependency installation | `cd SAVR-old/web && npm install` | Available | `SAVR-old/web/package-lock.json`, README guidance |
| Mobile dependency installation | `cd SAVR-old/mobile && npm install --legacy-peer-deps` | Available | `SAVR-old/README.md` quick-start guidance |
| Web lint | `cd SAVR-old/web && npm run lint` | Available | `SAVR-old/web/package.json` |
| Web production build | `cd SAVR-old/web && npm run build` | Available | `SAVR-old/web/package.json` |
| Playwright E2E | `cd SAVR-old/e2e-tests && npm run test:e2e` | Available | `SAVR-old/e2e-tests/package.json` |
| Playwright UI mode | `cd SAVR-old/e2e-tests && npm run test:e2e:ui` | Available | `SAVR-old/e2e-tests/package.json` |
| Playwright headed mode | `cd SAVR-old/e2e-tests && npm run test:e2e:headed` | Available | `SAVR-old/e2e-tests/package.json` |
| Playwright debug mode | `cd SAVR-old/e2e-tests && npm run test:e2e:debug` | Available | `SAVR-old/e2e-tests/package.json` |
| Web type-check | No committed dedicated script; direct command inferred from checked-in TypeScript config would be `cd SAVR-old/web && npx tsc --noEmit` | Gap | TypeScript config exists, script absent |
| Mobile type-check | No committed dedicated script; direct command inferred from checked-in TypeScript config would be `cd SAVR-old/mobile && npx tsc --noEmit` | Gap | TypeScript config exists, script absent |
| Mobile Expo validation | No committed validation script found beyond `expo start`, `expo run:android`, `expo run:ios`, and `expo start --web` | Gap | `SAVR-old/mobile/package.json` |
| Existing unit/integration tests | No committed non-E2E test command found | Gap | no script in root/web/mobile packages |
| Supabase migration validation | No committed repository command found for `supabase db lint`, `supabase db reset`, or similar | Gap | migration SQL present, validation script absent |
| Security scanning | No committed repository command found for dependency or code security scanning | Gap | no script or workflow imported |

## Rules for future agents

- Do not claim a gate passed unless the exact command was actually run and its output is recorded.
- When a gap exists, document it in the PR and, if appropriate, add the missing gate in a dedicated future phase rather than hiding the gap.
- Reproducible validation is a required early migration phase before broad visual adaptation.
