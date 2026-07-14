# ADR-003 — Canonical Expo Version for savr-platform/mobile

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** GooseyPrime  

---

## Context

The SAVR consolidation imported the production mobile application from `SAVR-old/mobile/` into `savr-platform/mobile/`. During Phase 4–5 shell and feature migration work, the canonical platform was initialised with a newer Expo SDK version than the reference repository, without a formal decision record. This ADR documents that transition and verifies compatibility.

---

## Reference version (SAVR-old/mobile — pinned at add8dd5c)

| Package | Version |
|---------|---------|
| expo | ^54.0.33 |
| react-native | ^0.75.5 |
| react | 19.1.0 |

Source: `SAVR-old/mobile/package.json` at commit `add8dd5c125ee27c6620897eec598d13920b4ce6`.

---

## Canonical version (savr-platform/mobile — after Corrective PR 4)

| Package | Version |
|---------|---------|
| expo | ^57.0.4 |
| react-native | ^0.86.0 |
| react | 19.2.3 |
| expo-auth-session | ~57.0.2 |
| expo-camera | ~57.0.1 |
| expo-constants | ~57.0.3 |
| expo-font | ~57.0.0 |
| expo-image-picker | ~57.0.2 |
| expo-status-bar | ~57.0.0 |
| expo-system-ui | ~57.0.0 |
| expo-web-browser | ^57.0.0 |
| @react-native-async-storage/async-storage | 2.2.0 |
| react-native-gesture-handler | ~2.32.0 |
| react-native-safe-area-context | ~5.7.0 |
| react-native-screens | 4.25.2 |
| react-native-svg | 15.15.4 |
| typescript | ~6.0.3 |

---

## How the version changed

The canonical platform was initialised during the Phase 4 application shell work with Expo SDK 57, skipping over SDK 55 and SDK 56. The upgrade was not documented as a decision at that time. This ADR formalises it retroactively.

The corrective PR 4 work also resolved schema and dependency mismatches discovered during this audit:
- Removed `newArchEnabled`, `edgeToEdgeEnabled`, and top-level `splash` from `app.json` (these fields were removed from the Expo 57 config-types schema: `@expo/config-types@57.0.1`).
- Added `expo-font` as a required peer dependency of `@expo/vector-icons`.
- Aligned all Expo SDK 57 package versions to the expected versions reported by `npx expo-doctor`.
- Added `@types/node` to devDependencies and `"types": ["node"]` to `tsconfig.json` to support the `node:` import protocol used in test files under TypeScript 6.0.
- Removed legacy Firebase `extra` fields from `app.json` that were superseded by `app.config.ts`.
- Added `expo-font` and `expo-status-bar` to the `plugins` array in `app.config.ts` as required by those packages.

---

## Compatibility evidence

All noncredential validation gates passed after alignment:

| Command | Result |
|---------|--------|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0, 50 warnings (pre-existing, 0 errors) |
| `npm run typecheck` | exit 0 |
| `npm run test:unit` | 17 passed, 0 failed |
| `npx expo-doctor` | 20/20 checks passed, no issues detected |
| `npx expo export --platform android` | Android Bundled 9014ms, 1071 modules, exit 0 |
| `npx expo export --platform ios` | iOS Bundled 15538ms, 1076 modules, exit 0 |

---

## Decision

**Expo SDK 57 / React Native 0.86 is accepted as the canonical mobile platform version for `savr-platform/mobile`.**

Rationale:
- All Expo SDK 57 compatibility checks pass (expo-doctor: 20/20).
- Both Android and iOS JS bundles build successfully.
- TypeScript and lint checks pass at 0 errors.
- Unit tests pass at 17/17.
- The reference repository (`SAVR-old/mobile`) is read-only and not affected by this change.
- No new native modules were introduced; all package selections follow Expo SDK 57 recommendations.

---

## Remaining physical-device and EAS validation gates

The following validations require external infrastructure not available in CI and remain deferred:

1. **Native EAS build (Android APK/AAB):** Requires EAS project configuration with a valid `projectId` and EAS build service credentials. This is a protected-environment manual release gate.
2. **Native EAS build (iOS IPA):** Requires Apple Developer Program membership, provisioning profiles, and EAS build service. Protected-environment manual release gate.
3. **On-device runtime testing:** Camera permissions, photo library access, OAuth session flow, and push notification behaviour require a physical device or managed emulator.
4. **Supabase live connectivity:** Auth, inventory, recipe, and meal-plan flows require a live Supabase project with matching schema and RLS policies.
5. **Google OAuth native flow:** Requires registered OAuth client IDs for both iOS and Android app bundles.

These gates do not block the acceptance of the JS bundle build compatibility established above.

---

## Consequences

- `savr-platform/mobile` targets Expo SDK 57 and React Native 0.86 going forward.
- Any future Expo SDK upgrade (58+) requires a new ADR and a dedicated PR.
- Major dependency version changes must continue to follow the corrective-track PR process.
- The reference repository (`SAVR-old/mobile`) remains pinned at Expo 54 and must not be modified.
