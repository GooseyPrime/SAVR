import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { GroceryList, GroceryItem } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getGroceryLists, updateGroceryList } from '../../lib/db';
import { colors, radii, shadowElevations } from '../../theme/index';

interface DbGroceryItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  checked?: boolean;
  category?: string;
}

interface DbGroceryList {
  id: string;
  title: string;
  items: DbGroceryItem[];
}

export default function GroceryListScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);

  useEffect(() => {
    loadGroceryList();
  }, [user]);

  const loadGroceryList = async () => {
    if (!user) return;

    try {
      const lists = await getGroceryLists(user.id);
      if (lists.length > 0) {
        const list = lists[0] as DbGroceryList;
        setGroceryList({
          id: list.id,
          name: list.title || 'Grocery List',
          items: (list.items || []).map((item, index) => ({
            id: item.id || `${list.id}-${index}`,
            name: item.name,
            quantity: item.quantity || 1,
            unit: item.unit || 'item',
            checked: Boolean(item.checked),
            category: item.category || 'other',
          })),
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load grocery list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadGroceryList();
  };

  const toggleItem = async (itemId: string) => {
    if (!groceryList) return;

    const updatedItems = groceryList.items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    try {
      await updateGroceryList(groceryList.id, {
        items: updatedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          checked: item.checked,
        })),
      } as any);
      setGroceryList({ ...groceryList, items: updatedItems });
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!groceryList || groceryList.items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={56} color={colors.foregroundMuted} />
        <Text style={styles.emptyText}>Your grocery list is empty</Text>
        <Text style={styles.emptySubtext}>
          Generate recipes to add items to your list
        </Text>
      </View>
    );
  }

  // Group by category
  const groupedItems = groceryList.items.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  // Checked count for progress
  const checkedCount = groceryList.items.filter((i) => i.checked).length;
  const total = groceryList.items.length;

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressRow}>
        <Ionicons name="cart" size={16} color={colors.foregroundMuted} />
        <Text style={styles.progressText}>
          {checkedCount} of {total} items
        </Text>
        {checkedCount === total && total > 0 && (
          <View style={styles.doneBadge}>
            <Text style={styles.doneBadgeText}>Done!</Text>
          </View>
        )}
      </View>

      <FlatList
        data={Object.keys(groupedItems)}
        keyExtractor={(category) => category}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item: category }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
            {groupedItems[category].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemRow, item.checked && styles.itemRowChecked]}
                onPress={() => toggleItem(item.id)}
                accessibilityLabel={`${item.checked ? 'Uncheck' : 'Check'} ${item.name}`}
              >
                <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                  {item.checked && (
                    <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressText: {
    fontSize: 13,
    color: colors.foregroundMuted,
    flex: 1,
  },
  doneBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  doneBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: radii.md,
    marginBottom: 8,
    ...shadowElevations.sm,
  },
  itemRowChecked: {
    opacity: 0.6,
    backgroundColor: colors.muted,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 2,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.foregroundMuted,
  },
  itemQuantity: {
    fontSize: 13,
    color: colors.foregroundMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
    gap: 10,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.foregroundMuted,
    textAlign: 'center',
  },
});
