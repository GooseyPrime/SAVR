# Source Origins

This file is the source registry for all repositories contributing to the SAVR consolidation workspace.

---

## Imported sources

| Folder | Role | Imported source repository | Expected source SHA | Verified SHA | Verification status | Import status | Read-only |
|---|---|---|---|---|---|---|---|
| `SAVR-old/` | Production architecture baseline, production feature baseline, backend/database contract reference, web/mobile implementation reference | `GooseyPrime/SAVR-old` | `645c870ad23e76e9fdd8a0e8c554120f70644d48` | Not verifiable from imported contents | Imported folder has no nested `.git` metadata and no committed manifest proving the expected head | Imported | Yes |
| `savr-premium-mobile-app/` | Approved visual-design, navigation, interaction, and responsive/mobile UX reference | `GooseyPrime/savr-premium-mobile-app` | `1273037c3ac98ce12a2fa81319879ee05301daf4` | Not verifiable from imported contents | Imported folder has no nested `.git` metadata and no committed manifest proving the expected head | Imported | Yes |
| `savr-platform/` | Canonical merged production application | N/A | N/A | N/A | Workspace intentionally not initialized with production code yet | Present but not initialized | No |

---

## Notes

- Source-head verification must remain explicitly unverified until future import provenance is committed or otherwise proven.
- Future production implementation work belongs only in `savr-platform/`.
