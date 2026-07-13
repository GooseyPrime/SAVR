import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, TouchableOpacity, Text, RefreshControl, TextInput } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Recipe } from '../../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import LoadingSpinner from '../../components/LoadingSpinner';
import RecipeCard from '../../components/RecipeCard';
import { Ionicons } from '@expo/vector-icons';
import { getRecipes, getInventory } from '../../lib/db';
import { generateRecipes } from '../../utils/api';
import { colors, radii, shadowElevations } from '../../theme/index';

type RecipesScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'MainTabs'>;

interface RecipesScreenProps {
  navigation: RecipesScreenNavigationProp;
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

export default function RecipesScreen({ navigation }: RecipesScreenProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRecipes();
  }, [user]);

  const loadRecipes = async () => {
    if (!user) return;

    try {
      const recipeList = await getRecipes(user.id);
      setRecipes(recipeList.map(mapDbRecipeToMobile));
    } catch (_error) {
      Alert.alert('Error', 'Failed to load recipes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecipes();
  };

  const handleGenerateRecipes = async () => {
    if (!user) return;

    try {
      setGenerating(true);
      const inventoryItems = await getInventory(user.id);
      const ingredients = inventoryItems.map((item) => item.name).filter(Boolean);
      if (ingredients.length === 0) {
        Alert.alert('No ingredients', 'Add items to your pantry first.');
        setGenerating(false);
        return;
      }
      await generateRecipes({
        ingredients,
        preferences: { difficulty: 'medium' }
      });
      Alert.alert('Success', 'Recipe generated!');
      loadRecipes();
    } catch (error: any) {
      const msg = error?.message || 'Failed to generate recipe';
      Alert.alert('Error', msg.includes('limit') ? 'Monthly limit reached. Upgrade for more.' : msg);
    } finally {
      setGenerating(false);
    }
  };

  const filteredRecipes = recipes.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.foregroundMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes…"
            placeholderTextColor={colors.foregroundMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.foregroundMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredRecipes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="restaurant-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching recipes' : 'No recipes yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Tap ✦ to generate recipes from your pantry'}
            </Text>
          </View>
        }
        contentContainerStyle={filteredRecipes.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      <TouchableOpacity
        style={[styles.fab, generating && styles.fabDisabled]}
        onPress={handleGenerateRecipes}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  listContent: {
    padding: 16,
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
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.foregroundMuted,
    textAlign: 'center',
    lineHeight: 20,
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
