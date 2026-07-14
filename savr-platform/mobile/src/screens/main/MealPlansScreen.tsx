import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
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

const MEAL_TYPE_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export default function MealPlansScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    } catch (error) {
      Alert.alert('Error', 'Failed to load meal plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMealPlans();
  };

  const handleGenerateMealPlan = async () => {
    if (!user) return;

    try {
      setGenerating(true);
      await generateMealPlan({ days: 7 });
      Alert.alert('Success', 'Meal plan generated successfully!');
      loadMealPlans();
    } catch (error) {
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          // Group meals by date first, then by meal_type within each date,
          // so all days of a multi-day plan remain visible.
          const mealsByDate = (item.meals ?? []).reduce((dateAcc, meal) => {
            const day = meal.date ?? item.start_date;
            if (!dateAcc[day]) dateAcc[day] = {} as Record<string, MealPlanMeal>;
            dateAcc[day][meal.meal_type] = meal;
            return dateAcc;
          }, {} as Record<string, Record<string, MealPlanMeal>>);

          const sortedDates = Object.keys(mealsByDate).sort();

          return (
            <View style={styles.mealPlanCard}>
              <View style={styles.dateRow}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <Text style={styles.dateText}>
                  {new Date(item.start_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              {sortedDates.map((date) => {
                const mealsByType = mealsByDate[date];
                return (
                  <View key={date}>
                    <Text style={styles.dayLabel}>
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <View style={styles.mealsContainer}>
                      {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => {
                        const meal = mealsByType?.[type];
                        if (!meal) return null;
                        return (
                          <View key={type} style={styles.mealRow}>
                            <Text style={styles.mealTypeIcon}>{MEAL_TYPE_ICONS[type] || '🍽️'}</Text>
                            <View style={styles.mealInfo}>
                              <Text style={styles.mealType}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </Text>
                              <Text style={styles.mealTitle} numberOfLines={1}>
                                {meal.recipe_title || 'Planned meal'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color={colors.foregroundMuted} />
            <Text style={styles.emptyText}>No meal plans yet</Text>
            <Text style={styles.emptySubtext}>Generate a 7-day meal plan to get started</Text>
          </View>
        }
        contentContainerStyle={mealPlans.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      {/* Generate Meal Plan FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleGenerateMealPlan}
        disabled={generating}
      >
        {generating ? (
          <LoadingSpinner size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="sparkles" size={28} color={colors.primaryForeground} />
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
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
  },
  mealPlanCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    ...shadowElevations.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foregroundSecondary,
    marginTop: 10,
    marginBottom: 6,
  },
  mealsContainer: {
    gap: 10,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealTypeIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 12,
    color: colors.foregroundMuted,
    marginBottom: 2,
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 14,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.foregroundMuted,
    marginTop: 6,
    textAlign: 'center',
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
});
