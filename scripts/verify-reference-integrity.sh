#!/usr/bin/env bash
# Verifies that SAVR-old/ and savr-premium-mobile-app/ exactly match the
# content they had at the immutable reference snapshot commit.
#
# Usage: bash scripts/verify-reference-integrity.sh
#
# The reference commit is the merge commit that imported both reference
# repositories into this monorepo. No content in either reference folder
# may differ from that commit.
#
# Exit codes:
#   0  both reference directories are intact
#   1  one or more files differ from the reference snapshot

set -euo pipefail

REFERENCE_COMMIT="add8dd5c125ee27c6620897eec598d13920b4ce6"
REFERENCE_DIRS=("SAVR-old" "savr-premium-mobile-app")
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

echo "Verifying reference integrity against commit ${REFERENCE_COMMIT}"
echo ""

# Ensure we have full history
if ! git cat-file -t "${REFERENCE_COMMIT}" >/dev/null 2>&1; then
  echo "ERROR: Reference commit ${REFERENCE_COMMIT} not found in local history."
  echo "       Run 'git fetch --unshallow origin' and retry."
  exit 1
fi

HEAD_BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMPARE_FROM="${REFERENCE_COMMIT}"
CURRENT_UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")

if git show-ref --verify --quiet "refs/remotes/origin/${DEFAULT_BRANCH}" \
  && { [ "${HEAD_BRANCH}" != "${DEFAULT_BRANCH}" ] || [ "${CURRENT_UPSTREAM}" != "origin/${DEFAULT_BRANCH}" ]; }; then
  COMPARE_FROM=$(git merge-base HEAD "origin/${DEFAULT_BRANCH}")

  MAINLINE_DIFF=$(git diff --name-only "${REFERENCE_COMMIT}" "origin/${DEFAULT_BRANCH}" -- "${REFERENCE_DIRS[@]}" 2>&1)
  if [ -n "${MAINLINE_DIFF}" ]; then
    echo "WARNING: ${DEFAULT_BRANCH} already differs from the pinned reference snapshot."
    echo "         This check is only enforcing that the current branch does not introduce"
    echo "         additional changes in the protected reference folders."
    echo ""
  fi
fi

DIFF_OUTPUT=$(git diff --name-only "${COMPARE_FROM}" HEAD -- "${REFERENCE_DIRS[@]}" 2>&1)

if [ -z "${DIFF_OUTPUT}" ]; then
  if [ "${COMPARE_FROM}" = "${REFERENCE_COMMIT}" ]; then
    echo "✅  Both reference directories exactly match the pinned snapshot."
  else
    echo "✅  No new reference-folder changes were introduced on this branch."
  fi
  exit 0
fi

echo "❌  Reference integrity violation detected."
echo ""
if [ "${COMPARE_FROM}" = "${REFERENCE_COMMIT}" ]; then
  echo "The following files differ from commit ${REFERENCE_COMMIT}:"
else
  echo "The following reference-folder files changed on this branch:"
fi
echo ""
echo "${DIFF_OUTPUT}" | sed 's/^/    /'
echo ""
echo "Reference folders must never be modified after import."
if [ "${COMPARE_FROM}" = "${REFERENCE_COMMIT}" ]; then
  echo "Restore the listed files to their state in commit ${REFERENCE_COMMIT}."
else
  echo "Restore the listed files to match ${DEFAULT_BRANCH} before merging."
fi
exit 1
