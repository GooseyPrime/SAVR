import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { useAuth } from '../../contexts/AuthContext';
import { hasProAccess } from '../../lib/billing';
import { Ionicons } from '@expo/vector-icons';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getInventory, getRecipes, getMealPlans, type InventoryItem, type Recipe, type MealPlan } from '../../lib/db';
import { colors, radii, shadowElevations } from '../../theme/index';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'MainTabs'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);

  const loadData = async () => {
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
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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
    return mealPlans.flatMap((plan) => plan.meals).filter((meal) => meal.date === today);
  }, [mealPlans]);

  // Last 5 saved recipes — getRecipes() returns newest-first, so take the front
  const recentRecipes = useMemo(() => recipes.slice(0, 5), [recipes]);

  const displayName = userData?.displayName || user?.email?.split('@')[0] || 'Chef';

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {displayName}</Text>
        <Text style={styles.subgreeting}>What would you like to cook today?</Text>
      </View>

      {/* Primary Actions */}
      <View style={styles.primaryActions}>
        <TouchableOpacity
          style={[styles.primaryActionBtn, styles.primaryActionBtnHighlight]}
          onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Inventory' })}
          accessibilityLabel="Scan Ingredients"
        >
          <Ionicons name="camera" size={28} color={colors.primaryForeground} />
          <Text style={styles.primaryActionBtnText}>Scan Ingredients</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryActionBtn, styles.primaryActionBtnSecondary]}
          onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Recipes' })}
          accessibilityLabel="What Can I Make?"
        >
          <Ionicons name="sparkles" size={28} color={colors.primary} />
          <Text style={styles.primaryActionBtnTextSecondary}>What Can I Make?</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Inventory' })}
        >
          <Ionicons name="file-tray-full" size={22} color={colors.foregroundMuted} />
          <Text style={styles.statNumber}>{inventory.length}</Text>
          <Text style={styles.statLabel}>Pantry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Recipes' })}
        >
          <Ionicons name="restaurant" size={22} color={colors.foregroundMuted} />
          <Text style={styles.statNumber}>{recipes.length}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('MealPlans' as any)}
        >
          <Ionicons name="calendar" size={22} color={colors.foregroundMuted} />
          <Text style={styles.statNumber}>{mealPlans.length}</Text>
          <Text style={styles.statLabel}>Planned</Text>
        </TouchableOpacity>
      </View>

      {/* Expiring Soon */}
      {expiringItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={styles.sectionTitle}>Expiring Soon</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Inventory' })}>
              <Text style={styles.sectionLink}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {expiringItems.map((item, idx) => {
              const exp = new Date(item.expiry_date!);
              const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <View
                  key={item.id}
                  style={[styles.listRow, idx < expiringItems.length - 1 && styles.listRowBorder]}
                >
                  <View>
                    <Text style={styles.listRowTitle}>{item.name}</Text>
                    <Text style={styles.listRowSub}>{item.quantity} {item.unit}</Text>
                  </View>
                  <Text style={[styles.expiryBadge, daysLeft <= 1 ? styles.expiryUrgent : styles.expiryWarning]}>
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Today's Meals */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="calendar" size={16} color={colors.foregroundMuted} />
            <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('MealPlans' as any)}>
            <Text style={styles.sectionLink}>Plan week</Text>
          </TouchableOpacity>
        </View>
        {todaysMeals.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>No meals planned for today</Text>
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => navigation.navigate('MealPlans' as any)}
            >
              <Text style={styles.emptyActionText}>+ Add meal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            {todaysMeals.map((meal, idx) => (
              <View
                key={idx}
                style={[styles.listRow, idx < todaysMeals.length - 1 && styles.listRowBorder]}
              >
                <View style={styles.mealIcon}>
                  <Ionicons name="restaurant" size={20} color={colors.foregroundMuted} />
                </View>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle}>{meal.recipe_title || 'Unnamed meal'}</Text>
                  <Text style={styles.listRowSub} numberOfLines={1}>{meal.meal_type}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Recent Recipes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="restaurant" size={16} color={colors.foregroundMuted} />
            <Text style={styles.sectionTitle}>Recent Recipes</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Recipes' })}>
            <Text style={styles.sectionLink}>All recipes</Text>
          </TouchableOpacity>
        </View>
        {recentRecipes.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>No saved recipes yet</Text>
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Recipes' })}
            >
              <Text style={styles.emptyActionText}>✨ Generate recipe</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recipesContainer}>
            {recentRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeRow}
                onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Recipes' })}
              >
                <View style={styles.recipeIcon}>
                  <Ionicons name="restaurant" size={22} color={colors.foregroundMuted} />
                </View>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{recipe.title}</Text>
                  <View style={styles.recipeMetaRow}>
                    {recipe.cook_time_minutes != null && (
                      <Text style={styles.recipeMeta}>⏱ {recipe.cook_time_minutes} min</Text>
                    )}
                    {recipe.servings != null && (
                      <Text style={styles.recipeMeta}>{recipe.servings} servings</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* AI Chef Chat — Pro feature */}
      {hasProAccess(userData) && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.proAction}
            onPress={() => navigation.navigate('Chat')}
          >
            <View style={styles.proActionIconWrap}>
              <Ionicons name="chatbubbles" size={22} color={colors.primaryForeground} />
            </View>
            <View style={styles.listRowContent}>
              <Text style={styles.listRowTitle}>AI Chef Chat</Text>
              <Text style={styles.listRowSub}>Ask our AI chef anything</Text>
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Empty Pantry CTA */}
      {inventory.length === 0 && (
        <View style={styles.section}>
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="file-tray-full" size={40} color={colors.foregroundMuted} />
            <Text style={[styles.sectionTitle, { marginTop: 12, textAlign: 'center' }]}>Your pantry is empty</Text>
            <Text style={[styles.emptyText, { marginTop: 4 }]}>Scan your ingredients to get started</Text>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => navigation.navigate('MainTabs' as any, { screen: 'Inventory' })}
            >
              <Ionicons name="camera" size={18} color={colors.primaryForeground} />
              <Text style={styles.primaryCtaText}>Scan Ingredients</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  subgreeting: {
    fontSize: 15,
    color: colors.foregroundSecondary,
  },
  primaryActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    borderRadius: radii.xl,
    minHeight: 110,
  },
  primaryActionBtnHighlight: {
    backgroundColor: colors.primary,
  },
  primaryActionBtnSecondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
    textAlign: 'center',
  },
  primaryActionBtnTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    color: colors.foregroundMuted,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  sectionLink: {
    fontSize: 13,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadowElevations.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowContent: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  listRowSub: {
    fontSize: 12,
    color: colors.foregroundMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  expiryBadge: {
    fontSize: 12,
    fontWeight: '500',
  },
  expiryUrgent: {
    color: colors.error,
  },
  expiryWarning: {
    color: colors.warning,
  },
  mealIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.foregroundSecondary,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  emptyActionText: {
    fontSize: 13,
    color: colors.foreground,
  },
  recipesContainer: {
    gap: 8,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  recipeMeta: {
    fontSize: 11,
    color: colors.foregroundMuted,
  },
  proAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginRight: 8,
  },
  proBadgeText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '700',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  bottomPad: {
    height: 32,
  },
});
