# Source Origins

This file is the source registry for all repositories contributing to the SAVR consolidation workspace.

---

## Imported sources

| Folder | Role | Imported source repository | Expected source SHA | Verified SHA | Verification status | Import status | Read-only |
|---|---|---|---|---|---|---|---|
| `SAVR-old/` | Production architecture baseline, production feature baseline, backend/database contract reference, web/mobile implementation reference | `GooseyPrime/SAVR-old` | `645c870ad23e76e9fdd8a0e8c554120f70644d48` | Not verifiable from imported contents | Imported folder has no nested `.git` metadata and no committed manifest proving the expected head | Imported | Yes |
| `savr-premium-mobile-app/` | Approved visual-design, navigation, interaction, and responsive/mobile UX reference | `GooseyPrime/savr-premium-mobile-app` | `1273037c3ac98ce12a2fa81319879ee05301daf4` | Not verifiable from imported contents | Imported folder has no nested `.git` metadata and no committed manifest proving the expected head | Imported | Yes |
| `savr-platform/` | Canonical merged production application | N/A | N/A | N/A | Initialized — all production code lives here after Phase 1 baseline import | Active | No |

---

## Immutable reference snapshot

Both reference directories are pinned to the following monorepo commit and must never diverge from it:

```
add8dd5c125ee27c6620897eec598d13920b4ce6
```

Reference-integrity CI (`reference-integrity.yml`) enforces this invariant on every push and pull request using `scripts/verify-reference-integrity.sh`. The script is branch-aware: on non-`main` branches it checks only that the branch does not introduce new reference-folder changes relative to `main`; on `main` it compares directly against the pinned commit.

### Known divergence on `main` (pre-existing)

As of corrective PR 4, `main` diverges from `add8dd5c` in the following files:

- `SAVR-old/mobile/package.json` — expo bumped from `^54.0.33` to `^57.0.4`; react-native from `^0.75.5` to `^0.86.0`
- `SAVR-old/web/package.json` — minor version bump
- `SAVR-old/e2e-tests/package-lock.json`, `SAVR-old/mobile/package-lock.json`, `SAVR-old/package-lock.json`, `SAVR-old/web/package-lock.json`, `savr-premium-mobile-app/package-lock.json` — lockfiles removed
- `savr-premium-mobile-app/package.json` — minor version bumps

These changes were applied to `SAVR-old/` and `savr-premium-mobile-app/` during corrective PRs 1 and 4 and violate the read-only reference-folder rule. A dedicated governance PR is required to restore these files to the pinned state and prevent future mutations. Until that PR is merged, `bash scripts/verify-reference-integrity.sh` on `main` will report an error.

---

## Notes

- Source-head verification must remain explicitly unverified until future import provenance is committed or otherwise proven.
- Future production implementation work belongs only in `savr-platform/`.
- Major framework upgrades to `savr-platform` packages require an ADR and a dedicated PR before Dependabot automation can apply them.
