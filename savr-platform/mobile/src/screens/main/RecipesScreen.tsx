import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
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

type RecipeFilter = 'all' | 'ai' | 'quick';

const FILTER_LABELS: Record<RecipeFilter, string> = {
  all: 'All',
  ai: 'AI Generated',
  quick: 'Quick (<30m)',
};

export default function RecipesScreen({ navigation }: RecipesScreenProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RecipeFilter>('all');

  useEffect(() => {
    loadRecipes();
  }, [user]);

  const loadRecipes = async () => {
    if (!user) return;

    try {
      const recipeList = await getRecipes(user.id);
      setRecipes(recipeList.map(mapDbRecipeToMobile));
    } catch (error) {
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

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeFilter === 'ai') return (recipe as any).isAiGenerated ?? false;
      if (activeFilter === 'quick') return ((recipe.prepTime ?? 0) + recipe.cookTime) <= 30;
      return true;
    });
  }, [recipes, searchQuery, activeFilter]);

  const handleGenerateRecipes = async () => {
    if (!user) return;

    try {
      setGenerating(true);
      const inventoryItems = await getInventory(user.id);
      const ingredients = inventoryItems.map((item) => item.name).filter(Boolean);
      if (ingredients.length === 0) {
        Alert.alert('No ingredients', 'Add items to your pantry first.');
        return;
      }
      await generateRecipes({ ingredients, preferences: { difficulty: 'medium' } });
      Alert.alert('Success', 'Recipe generated!');
      loadRecipes();
    } catch (error: any) {
      const msg = error?.message || 'Failed to generate recipe';
      Alert.alert('Error', msg.includes('limit') ? 'Monthly limit reached. Upgrade for more.' : msg);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.foregroundMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor={colors.foregroundMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={colors.foregroundMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'ai', 'quick'] as RecipeFilter[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.chip, activeFilter === filter && styles.chipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.chipText, activeFilter === filter && styles.chipTextActive]}>
              {FILTER_LABELS[filter]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(searchQuery || activeFilter !== 'all') && (
        <Text style={styles.resultsCount}>
          {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'} found
        </Text>
      )}

      <FlatList
        data={filteredRecipes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={56} color={colors.foregroundMuted} />
            <Text style={styles.emptyText}>
              {recipes.length === 0 ? 'No recipes yet' : 'No matching recipes'}
            </Text>
            <Text style={styles.emptySubtext}>
              {recipes.length === 0
                ? 'Generate your first recipe from your pantry'
                : 'Try adjusting your search or filter'}
            </Text>
          </View>
        }
        contentContainerStyle={filteredRecipes.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      {/* Generate Recipe FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleGenerateRecipes} disabled={generating}>
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
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.foregroundSecondary,
  },
  chipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 13,
    color: colors.foregroundMuted,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
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
