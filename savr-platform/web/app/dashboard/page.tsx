'use client';

import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackCheckoutIntentIfReturning } from '@/lib/checkout';
import { getInventory, getRecipes, getMealPlans, type InventoryItem, type Recipe, type MealPlan } from '@/lib/db';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, userData } = useAuth();
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get('stripeSuccess') === 'true';
  const [showSuccessBanner, setShowSuccessBanner] = useState(stripeSuccess);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Detect if user is returning from Stripe Checkout and set the checkout intent flag
  useEffect(() => {
    trackCheckoutIntentIfReturning();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const [inv, rec, plans] = await Promise.all([
          getInventory(user.id),
          getRecipes(user.id),
          getMealPlans(user.id),
        ]);
        setInventory(inv);
        setRecipes(rec);
        setMealPlans(plans);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Items expiring within 3 days
  const expiringItems = useMemo(() => {
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return inventory
      .filter((item) => {
        if (!item.expiry_date) return false;
        const exp = new Date(item.expiry_date);
        return exp >= now && exp <= threeDays;
      })
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())
      .slice(0, 5);
  }, [inventory]);

  // Today's meal plan entries
  const todaysMeals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return mealPlans
      .flatMap((plan) => plan.meals)
      .filter((meal) => meal.date === today);
  }, [mealPlans]);

  // Last 5 saved recipes
  const recentRecipes = useMemo(() => recipes.slice(-5).reverse(), [recipes]);

  const displayName = userData?.display_name || user?.email?.split('@')[0] || 'Chef';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl">
        {/* Stripe success banner */}
        {showSuccessBanner && (
          <div className="mb-6 rounded-xl px-5 py-4 flex items-center justify-between bg-success/10 border border-success/25">
            <div>
              <p className="font-semibold text-success">Subscription activated!</p>
              <p className="text-sm text-foreground-muted">Your plan is now active. Your 5-day free trial has started — enjoy full access.</p>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="text-foreground-muted hover:text-foreground ml-4 text-xl leading-none"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        {/* Greeting */}
        <section className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-foreground break-words">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-foreground-secondary mt-1">
            What would you like to cook today?
            {userData?.subscription_tier === 'basic' && (
              <Link href="/pricing" className="ml-2 text-primary hover:text-primary-hover transition text-sm">
                Upgrade to Pro →
              </Link>
            )}
          </p>
        </section>

        {/* Primary Actions */}
        <section className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/upload"
            className="flex flex-col items-center justify-center gap-3 p-5 bg-primary text-primary-foreground rounded-xl min-h-[110px] hover:bg-primary-hover transition font-medium"
          >
            <span className="text-3xl" aria-hidden="true">📸</span>
            <span className="font-medium text-center text-sm leading-tight">Scan Ingredients</span>
          </Link>
          <Link
            href="/recipes"
            className="flex flex-col items-center justify-center gap-3 p-5 bg-surface-raised border border-border-strong rounded-xl text-foreground min-h-[110px] hover:border-primary/40 transition"
          >
            <span className="text-3xl" aria-hidden="true">✨</span>
            <span className="font-medium text-center text-sm leading-tight">What Can I Make?</span>
          </Link>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-3 gap-3 mb-6">
          <Link
            href="/inventory"
            className="flex flex-col items-center p-4 bg-surface rounded-lg border border-border hover:border-border-strong transition"
          >
            <span className="text-xl mb-1" aria-hidden="true">📦</span>
            <span className="text-xl font-semibold text-foreground">{loading ? '–' : inventory.length}</span>
            <span className="text-xs text-foreground-muted mt-0.5">Pantry</span>
          </Link>
          <Link
            href="/recipes"
            className="flex flex-col items-center p-4 bg-surface rounded-lg border border-border hover:border-border-strong transition"
          >
            <span className="text-xl mb-1" aria-hidden="true">🍳</span>
            <span className="text-xl font-semibold text-foreground">{loading ? '–' : recipes.length}</span>
            <span className="text-xs text-foreground-muted mt-0.5">Recipes</span>
          </Link>
          <Link
            href="/meal-plans"
            className="flex flex-col items-center p-4 bg-surface rounded-lg border border-border hover:border-border-strong transition"
          >
            <span className="text-xl mb-1" aria-hidden="true">📅</span>
            <span className="text-xl font-semibold text-foreground">{loading ? '–' : mealPlans.length}</span>
            <span className="text-xs text-foreground-muted mt-0.5">Planned</span>
          </Link>
        </section>

        {/* Expiring Soon */}
        {expiringItems.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-foreground flex items-center gap-2">
                <span aria-hidden="true">⚠️</span> Expiring Soon
              </h2>
              <Link href="/inventory" className="text-sm text-primary hover:text-primary-hover flex items-center gap-1 transition">
                View all →
              </Link>
            </div>
            <div className="glass-card rounded-lg divide-y divide-border">
              {expiringItems.map((item) => {
                const exp = new Date(item.expiry_date!);
                const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-foreground font-medium">{item.name}</p>
                      <p className="text-sm text-foreground-muted">{item.quantity} {item.unit}</p>
                    </div>
                    <span className={`text-sm font-medium ${daysLeft <= 1 ? 'text-error' : 'text-warning'}`}>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Today's Meals */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-foreground flex items-center gap-2">
              <span aria-hidden="true">📅</span> Today&apos;s Meals
            </h2>
            <Link href="/meal-plans" className="text-sm text-primary hover:text-primary-hover flex items-center gap-1 transition">
              Plan week →
            </Link>
          </div>
          {loading ? null : todaysMeals.length === 0 ? (
            <div className="glass-card rounded-lg px-4 py-8 text-center">
              <p className="text-foreground-secondary text-sm mb-3">No meals planned for today</p>
              <Link
                href="/meal-plans"
                className="inline-flex items-center gap-1 text-sm px-4 py-2 border border-border-strong rounded-lg text-foreground hover:border-primary/40 transition"
              >
                + Add meal
              </Link>
            </div>
          ) : (
            <div className="glass-card rounded-lg divide-y divide-border">
              {todaysMeals.map((meal, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 bg-surface-raised rounded-lg flex items-center justify-center shrink-0 text-lg" aria-hidden="true">
                    🍽️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{meal.recipe_title || 'Unnamed meal'}</p>
                    <p className="text-sm text-foreground-muted capitalize">{meal.meal_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Recipes */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-foreground flex items-center gap-2">
              <span aria-hidden="true">🍳</span> Recent Recipes
            </h2>
            <Link href="/recipes" className="text-sm text-primary hover:text-primary-hover flex items-center gap-1 transition">
              All recipes →
            </Link>
          </div>
          {loading ? null : recentRecipes.length === 0 ? (
            <div className="glass-card rounded-lg px-4 py-8 text-center">
              <p className="text-foreground-secondary text-sm mb-3">No saved recipes yet</p>
              <Link
                href="/recipes"
                className="inline-flex items-center gap-1 text-sm px-4 py-2 border border-border-strong rounded-lg text-foreground hover:border-primary/40 transition"
              >
                ✨ Generate recipe
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentRecipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  href="/recipes"
                  className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border hover:border-border-strong hover:bg-surface-raised transition"
                >
                  <div className="w-12 h-12 bg-surface-raised rounded-lg flex items-center justify-center shrink-0 text-xl" aria-hidden="true">
                    🍳
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{recipe.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {recipe.cook_time_minutes != null && (
                        <span className="text-xs text-foreground-muted">⏱ {recipe.cook_time_minutes} min</span>
                      )}
                      {recipe.servings != null && (
                        <span className="text-xs text-foreground-muted">{recipe.servings} servings</span>
                      )}
                    </div>
                  </div>
                  <span className="text-foreground-muted shrink-0">›</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Empty Pantry CTA */}
        {inventory.length === 0 && !loading && (
          <section>
            <div className="glass-card rounded-lg p-6 text-center">
              <p className="text-4xl mb-3" aria-hidden="true">📦</p>
              <h3 className="font-medium text-foreground mb-2">Your pantry is empty</h3>
              <p className="text-sm text-foreground-secondary mb-4">
                Scan your ingredients to get started with personalised recipes
              </p>
              <Link
                href="/upload"
                className="inline-block px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary-hover transition"
              >
                Scan Ingredients
              </Link>
            </div>
          </section>
        )}

        {/* Secondary Quick Actions */}
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/meal-plans"
              className="p-4 border border-border rounded-lg hover:border-border-strong hover:bg-surface transition"
            >
              <div className="text-2xl mb-2" aria-hidden="true">📅</div>
              <h3 className="font-semibold text-foreground text-sm mb-1">Plan Meals</h3>
              <p className="text-xs text-foreground-muted">Create a weekly meal plan</p>
            </Link>
            <Link
              href="/grocery-lists"
              className="p-4 border border-border rounded-lg hover:border-border-strong hover:bg-surface transition"
            >
              <div className="text-2xl mb-2" aria-hidden="true">🛒</div>
              <h3 className="font-semibold text-foreground text-sm mb-1">Grocery List</h3>
              <p className="text-xs text-foreground-muted">Manage your shopping lists</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
