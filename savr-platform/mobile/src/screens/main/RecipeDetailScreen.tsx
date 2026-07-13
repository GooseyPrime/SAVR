import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { Recipe } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { MainStackParamList } from '../../navigation/MainNavigator';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { getRecipe } from '../../lib/db';
import { colors, radii, shadowElevations } from '../../theme/index';

type RecipeDetailScreenRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>;

interface RecipeDetailScreenProps {
  route: RecipeDetailScreenRouteProp;
}

function mapDbRecipeToMobile(recipe: any): Recipe {
  const normalizedInstructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.map((instruction: any) =>
        typeof instruction === 'string'
          ? instruction
          : instruction?.text || String(instruction ?? '')
      )
    : [];

  return {
    id: recipe.id,
    title: recipe.title || 'Untitled Recipe',
    description: recipe.description || '',
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    instructions: normalizedInstructions,
    prepTime: recipe.prep_time_minutes ?? recipe.prep_time,
    cookTime: recipe.cook_time_minutes ?? recipe.cook_time ?? 0,
    servings: recipe.servings ?? 1,
    difficulty: recipe.difficulty,
    cuisine: recipe.cuisine,
    dietaryTags: recipe.dietary_tags,
    imageUrl: recipe.image_url,
    createdAt: recipe.created_at,
    recipeType: 'human',
  };
}

export default function RecipeDetailScreen({ route }: RecipeDetailScreenProps) {
  const { recipeId } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    loadRecipe();
  }, [recipeId, user?.id]);

  const loadRecipe = async () => {
    if (!user) return;
    try {
      const dbRecipe = await getRecipe(recipeId);
      if (dbRecipe) {
        setRecipe(mapDbRecipeToMobile(dbRecipe));
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!recipe) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.foregroundMuted} />
        <Text style={styles.errorText}>Recipe not found</Text>
      </View>
    );
  }

  const totalTime = (recipe.prepTime ?? 0) + recipe.cookTime;
  const ingredientsList = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ing) =>
        typeof ing === 'string' ? ing : `${ing.quantity} ${ing.unit} ${ing.name}`
      )
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {recipe.imageUrl && (
        <Image source={{ uri: recipe.imageUrl }} style={styles.image} />
      )}

      <View style={styles.content}>
        <Text style={styles.title}>{recipe.title}</Text>

        {recipe.recipeType === 'pet' && (
          <View style={styles.petBanner}>
            <Ionicons name="paw" size={16} color={colors.warning} />
            <Text style={styles.petBannerText}>
              Safe for {recipe.species === 'cat' ? 'cats' : 'dogs'}. Always consult your vet. Occasional supplement only — not a complete diet.
            </Text>
          </View>
        )}

        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={15} color={colors.primary} />
            <Text style={styles.metaText}>{totalTime} min</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="people-outline" size={15} color={colors.primary} />
            <Text style={styles.metaText}>{recipe.servings} servings</Text>
          </View>
          {recipe.difficulty && (
            <View style={styles.metaChip}>
              <Ionicons name="bar-chart-outline" size={15} color={colors.primary} />
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          )}
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.sectionCard}>
            {ingredientsList.map((line, index) => (
              <View key={index} style={[styles.listItem, index < ingredientsList.length - 1 && styles.listItemBorder]}>
                <View style={styles.bullet} />
                <Text style={styles.listItemText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 14,
    lineHeight: 32,
  },
  description: {
    fontSize: 15,
    color: colors.foregroundSecondary,
    marginBottom: 18,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 12,
    flexShrink: 0,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.foregroundSecondary,
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  stepNumberText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: colors.foregroundSecondary,
    lineHeight: 22,
    paddingTop: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.foregroundMuted,
  },
  petBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
  },
  petBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
    lineHeight: 18,
  },
});
