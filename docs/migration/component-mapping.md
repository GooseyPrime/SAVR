# Initial Component and Screen Mapping

| Premium visual component or screen | Production web counterpart | Production mobile counterpart | Data dependency | API dependency | Migration action | Risk level |
|---|---|---|---|---|---|---|
| Splash / onboarding flow | `SAVR-old/web/app/page.tsx`, auth entry pages | `mobile/src/screens/auth/WelcomeScreen.tsx` | user preferences, onboarding state | auth callback behavior | Adapt presentation | Medium |
| Auth presentation | `web/app/sign-in/page.tsx`, `web/app/sign-up/page.tsx`, auth callback/reset flows | `mobile/src/screens/auth/SignInScreen.tsx`, `SignUpScreen.tsx` | `users`, auth session | Supabase Auth, OAuth callbacks | Rebuild against production contract | High |
| Home dashboard | `web/app/dashboard/page.tsx` | `mobile/src/screens/main/HomeScreen.tsx` | users, inventory, meal plans, recipes | authenticated reads, possible AI quick actions | Adapt presentation | Medium |
| Pantry / inventory | `web/app/inventory/page.tsx` | `mobile/src/screens/main/InventoryScreen.tsx` | `inventory` | inventory CRUD, storage uploads | Rebuild against production contract | High |
| Scanner capture shell | `web/app/upload/page.tsx` plus scanning helpers | mobile image-picker and camera flows | inventory draft data | image-analysis, barcode, OCR paths | Rebuild against production contract | High |
| Scan-result review flow | web upload/review patterns and labeling/edit support | `mobile/src/components/ImagePickerComponent.tsx`, related review screens | inventory draft data, expiry/category metadata | analyze-image, scan-receipt, storage | Adapt presentation | High |
| Recipes list | `web/app/recipes/page.tsx` | `mobile/src/screens/main/RecipesScreen.tsx` | `recipes`, favorites, inventory context | create-recipe, import-recipe | Adapt presentation | Medium |
| Recipe detail | `web/app/recipe/page.tsx` | `mobile/src/screens/main/RecipeDetailScreen.tsx` | `recipes` | recipe reads, substitution support | Adapt presentation | Medium |
| Cooking Mode | `web/app/cook/[recipeId]/page.tsx` | cooking-related mobile flow from recipe detail | `recipes`, user preferences | none required beyond recipe data | Restyle only | Low |
| Meal Plans | `web/app/meal-plans/page.tsx` | `mobile/src/screens/main/MealPlansScreen.tsx` | `meal_plans`, recipes, preferences | create-meal-plan | Rebuild against production contract | High |
| Grocery List | `web/app/grocery-lists/page.tsx` | `mobile/src/screens/main/GroceryListScreen.tsx` | `grocery_lists`, meal plans, inventory | create-grocery-list | Rebuild against production contract | High |
| Chat / AI assistant | `web/app/chat/page.tsx` | `mobile/src/screens/main/ChatScreen.tsx` | `chat_history`, subscription state | chat endpoint | Preserve unchanged | Medium |
| Profile | auth and settings/profile surfaces in web app | `mobile/src/screens/main/ProfileScreen.tsx` | `users`, subscription fields | auth, Stripe-linked user state | Adapt presentation | Medium |
| Settings / preferences | `web/app/settings/page.tsx`, `preferences/page.tsx` | settings and preference flows in profile/mobile settings surfaces | `users.preferences`, subscription fields | auth, Stripe portal, AI settings if retained | Rebuild against production contract | High |
| Pricing / subscriptions | `web/app/pricing/page.tsx`, `subscription-debug/page.tsx` | mobile profile/subscription affordances | `users` subscription fields | Stripe checkout, portal, webhook reconciliation | Preserve unchanged | High |
| Transfer / sharing | `web/app/transfer/[token]/page.tsx` | no clearly equivalent premium flow | `transfer_sessions`, shared recipes | transfer-session API | Defer pending architecture decision | High |
| Labeling / dataset tools | `web/app/labeling/page.tsx`, `export-dataset/page.tsx` | `mobile/src/screens/main/LabelingScreen.tsx` | labeling images, annotations | labeling API routes | Consolidate duplicate implementations | High |
| Premium browser-storage guest flows | no production-equivalent contract | no production-equivalent contract | browser-local storage only | none | Do not port | High |
| Premium sessionStorage grocery handoff | no production-equivalent contract | no production-equivalent contract | sessionStorage only | none | Do not port | High |
