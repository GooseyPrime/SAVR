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
            <Ionicons name="paw" size={16} color={colors.pet} style={{ marginRight: 8 }} />
            <Text style={styles.petBannerText}>
              Safe for {recipe.species === 'cat' ? 'cats' : 'dogs'}. Always consult your vet.
              These are occasional supplements, not a complete diet.
            </Text>
          </View>
        )}

        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        {/* Meta row */}
        <View style={styles.metaRow}>
          {totalTime > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={16} color={colors.foregroundMuted} />
              <Text style={styles.metaText}>{totalTime} min</Text>
            </View>
          )}
          {recipe.servings > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="people-outline" size={16} color={colors.foregroundMuted} />
              <Text style={styles.metaText}>{recipe.servings} servings</Text>
            </View>
          )}
          {recipe.difficulty && (
            <View style={styles.metaChip}>
              <Ionicons name="bar-chart-outline" size={16} color={colors.foregroundMuted} />
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          )}
        </View>

        {/* Dietary tags */}
        {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
          <View style={styles.tagsRow}>
            {recipe.dietaryTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Start Cooking button (web-only feature — links to full cook mode) */}

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.card}>
            {ingredientsList.map((line, index) => (
              <View
                key={index}
                style={[styles.listRow, index < ingredientsList.length - 1 && styles.listRowBorder]}
              >
                <View style={styles.bulletDot} />
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
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.instructionBody}>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
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
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 12,
  },
  petBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.petLight,
    borderWidth: 1,
    borderColor: `${colors.pet}44`,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 12,
  },
  petBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.pet,
    lineHeight: 18,
  },
  description: {
    fontSize: 15,
    color: colors.foregroundSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    fontSize: 13,
    color: colors.foregroundSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
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
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bulletDot: {
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
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  stepNumber: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionBody: {
    flex: 1,
    paddingTop: 4,
  },
  instructionText: {
    fontSize: 15,
    color: colors.foregroundSecondary,
    lineHeight: 23,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 12,
  },
  errorText: {
    fontSize: 17,
    color: colors.foregroundMuted,
  },
});
