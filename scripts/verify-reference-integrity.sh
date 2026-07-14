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

echo "Verifying reference integrity against commit ${REFERENCE_COMMIT}"
echo ""

# Ensure we have full history
if ! git cat-file -t "${REFERENCE_COMMIT}" >/dev/null 2>&1; then
  echo "ERROR: Reference commit ${REFERENCE_COMMIT} not found in local history."
  echo "       Run 'git fetch --unshallow origin' and retry."
  exit 1
fi

DIFF_OUTPUT=$(git diff --name-only "${REFERENCE_COMMIT}" HEAD -- "${REFERENCE_DIRS[@]}" 2>&1)

if [ -z "${DIFF_OUTPUT}" ]; then
  echo "✅  Both reference directories exactly match the pinned snapshot."
  exit 0
fi

echo "❌  Reference integrity violation detected."
echo ""
echo "The following files differ from commit ${REFERENCE_COMMIT}:"
echo ""
echo "${DIFF_OUTPUT}" | sed 's/^/    /'
echo ""
echo "Reference folders must never be modified after import."
echo "Restore the listed files to their state in commit ${REFERENCE_COMMIT}."
exit 1
