# ADR-002 — Firebase Storage Backward Compatibility

**Date:** 2026-07-12  
**Status:** Documented — backward compat retained intentionally  
**Phase:** Phase 2 — Validation and Contract Reconciliation

---

## Context

The production codebase (`SAVR-old/`) and the imported baseline (`savr-platform/`) contain references to Firebase Storage in two distinct areas:

### 1. `savr-platform/web/lib/storage.ts`

Contains two helper functions:

```ts
export function isFirebaseStorageUrl(url: string): boolean {
  return url.includes('firebasestorage.googleapis.com');
}

export function getImageUrl(bucket: BucketName, pathOrUrl: string): string {
  if (isFirebaseStorageUrl(pathOrUrl)) {
    return pathOrUrl;  // return Firebase URL as-is for backward compatibility
  }
  return getPublicUrl(bucket, pathOrUrl);  // otherwise use Supabase
}
```

These functions exist to serve **existing user data** that may have been stored in Firebase Storage before the Supabase migration. They are intentional backward-compat helpers, not legacy cruft.

### 2. `savr-platform/mobile/app.json`

Contains empty Firebase config keys in the `extra` block:

```json
"extra": {
  "firebaseApiKey": "",
  "firebaseAuthDomain": "",
  "firebaseProjectId": "",
  "firebaseStorageBucket": "",
  "firebaseMessagingSenderId": "",
  "firebaseAppId": ""
}
```

These keys are **empty stubs** — they carry the Firebase config shape from the pre-migration app but have no values. The mobile app does not currently read these values for authentication or data access; Supabase Auth is the active auth system.

---

## Classification

| Reference | Classification | Action |
|---|---|---|
| `storage.ts` Firebase URL helpers | **Partially working production behavior** — handles legacy image URLs for existing users | Retain; document when safe to remove |
| `app.json` Firebase stubs | **Historical implementation** — empty keys, not used | Retain until confirmed no code reads them, then remove in a future cleanup ADR |

---

## Decision

1. **Retain `isFirebaseStorageUrl` and `getImageUrl` helpers** in `savr-platform/web/lib/storage.ts` until the production database is confirmed free of Firebase Storage URLs in user-facing image fields.
2. **Do not add new Firebase Storage write paths.** All new image uploads must target Supabase Storage.
3. **Retain empty Firebase stubs in `app.json`** for now. Do not populate them. A future phase will remove them once confirmed dead.
4. **Do not introduce Firebase Authentication, Firebase Firestore, or Firebase RTDB** in any new code path. Supabase Auth is the production identity system.

---

## Resolution criteria

- [ ] Audit production database image fields for `firebasestorage.googleapis.com` URLs
- [ ] If no Firebase Storage URLs exist in production: open a follow-up ADR to remove the helper functions
- [ ] If Firebase Storage URLs exist: plan a background migration to Supabase Storage and retain helpers until complete
- [ ] Remove empty Firebase stubs from `app.json` in a dedicated cleanup PR once confirmed unused

---

## Impact on downstream phases

- Phase 3 and beyond: use `getImageUrl` from `storage.ts` for all image rendering — do not bypass the Firebase-URL check until the above audit is complete
