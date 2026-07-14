#!/usr/bin/env bash

set -euo pipefail

test_dir="${1:-tests}"

if [ ! -d "$test_dir" ]; then
  echo "Unit test directory not found: $test_dir" >&2
  exit 1
fi

# Use a Bash-3-compatible loop instead of mapfile (macOS ships Bash 3.2)
test_files=()
while IFS= read -r file; do
  test_files+=("$file")
done < <(find "$test_dir" -type f -name '*.test.ts' -print | sort)

if [ "${#test_files[@]}" -eq 0 ]; then
  echo "No unit test files found under $test_dir/" >&2
  exit 1
fi

node --import tsx --test "${test_files[@]}"
