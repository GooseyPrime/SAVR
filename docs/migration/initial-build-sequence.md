# Initial Build Sequence

This is the recommended future PR order. Do not execute these phases in this guidance task.

## Sequence

1. **Copy validated production baseline into `savr-platform`**  
   Import the proven production structure and contracts without visual migration.

2. **Establish reproducible validation**  
   Recreate or document the minimal validation gates needed to prove web, mobile, database, and end-to-end behavior.

3. **Resolve stale configuration and source-contract conflicts**  
   Remove ambiguity around Firebase-era scripts, legacy billing tier names, workflow gaps, and any contract mismatch discovered during import.

4. **Create shared design tokens**  
   Port approved premium visual primitives into a production-safe shared design layer.

5. **Build web and mobile application shells**  
   Create production-safe web and mobile shells in `savr-platform` that preserve routing, auth boundaries, safe areas, and navigation affordances.

6. **Adapt Home**
7. **Adapt Pantry**
8. **Adapt Scanner and review flow**
9. **Adapt Recipes and Recipe Detail**
10. **Adapt Cooking Mode**
11. **Adapt Meal Plans**
12. **Adapt Grocery Lists**
13. **Adapt Profile and Settings**
14. **Validate authentication and guest conversion**
15. **Validate subscriptions and entitlements**
16. **Accessibility and responsive pass**
17. **End-to-end regression pass**
18. **Release-candidate hardening**

## Concurrency guidance

The safest concurrency points are:

- **After phase 4**: web shell and mobile shell work may run concurrently if both teams use the same documented token layer and do not fork data contracts.
- **After shells are stable**: feature adaptation can overlap only when two workstreams do not edit the same contract surface. Recommended parallel pairings are limited to:
  - Home + Pantry only after shared inventory/query patterns are established
  - Auth/guest-conversion validation + subscriptions/entitlements validation after all feature screens are migrated
- Scanner/review, recipes, meal plans, and grocery flows should stay mostly sequential because they share AI, inventory, and data-shaping contracts.

## PR segmentation rule

If a planned step cannot be described as one bounded feature or one bounded platform layer, split it again before implementation starts.
