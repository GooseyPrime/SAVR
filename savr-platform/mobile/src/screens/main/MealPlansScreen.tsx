import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getMealPlans } from '../../lib/db';
import { generateMealPlan } from '../../utils/api';
import { colors, radii, shadowElevations } from '../../theme/index';

interface MealPlanMeal {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | string;
  recipe_title?: string;
}

interface LocalMealPlan {
  id: string;
  start_date: string;
  meals: MealPlanMeal[];
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: 'sunny-outline',
  lunch: 'partly-sunny-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealPlansScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mealPlans, setMealPlans] = useState<LocalMealPlan[]>([]);

  useEffect(() => {
    loadMealPlans();
  }, [user]);

  const loadMealPlans = async () => {
    if (!user) return;

    try {
      const plans = await getMealPlans(user.id);
      setMealPlans(plans as LocalMealPlan[]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMealPlan = async () => {
    if (!user) return;

    try {
      setGenerating(true);
      await generateMealPlan({ days: 7 });
      Alert.alert('Success', 'Meal plan generated successfully!');
      loadMealPlans();
    } catch (_error) {
      Alert.alert('Error', 'Failed to generate meal plan');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={mealPlans}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>No meal plans yet</Text>
            <Text style={styles.emptySubtext}>Tap ✦ to generate a weekly meal plan</Text>
          </View>
        }
        contentContainerStyle={mealPlans.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => {
          const mealsOrdered = MEAL_ORDER
            .map(type => item.meals?.find(m => m.meal_type === type))
            .filter(Boolean) as MealPlanMeal[];

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.calendarDot}>
                  <Ionicons name="calendar" size={16} color={colors.primary} />
                </View>
                <Text style={styles.date}>
                  {new Date(item.start_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.meals}>
                {mealsOrdered.map(meal => (
                  <View key={meal.meal_type} style={styles.mealRow}>
                    <View style={styles.mealIconWrap}>
                      <Ionicons
                        name={(MEAL_ICONS[meal.meal_type] || 'restaurant-outline') as any}
                        size={14}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealType}>{MEAL_LABELS[meal.meal_type] || meal.meal_type}</Text>
                      <Text style={styles.mealTitle} numberOfLines={1}>
                        {meal.recipe_title || 'Planned meal'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.fab, generating && styles.fabDisabled]}
        onPress={handleGenerateMealPlan}
        disabled={generating}
      >
        {generating ? (
          <LoadingSpinner size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="sparkles" size={26} color={colors.primaryForeground} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 96,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.foregroundMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowElevations.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarDot: {
    width: 30,
    height: 30,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  meals: {
    gap: 10,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foregroundMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foregroundSecondary,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadowElevations.md,
  },
  fabDisabled: {
    opacity: 0.6,
  },
});
