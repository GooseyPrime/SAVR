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

const CATEGORY_ORDER = ['produce', 'protein', 'dairy', 'grains', 'other'];

function capitalized(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    } catch (_error) {
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
    } catch (_error) {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!groceryList || groceryList.items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyText}>Your grocery list is empty</Text>
        <Text style={styles.emptySubtext}>
          Generate recipes to populate your grocery list
        </Text>
      </View>
    );
  }

  const groupedItems = groceryList.items.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  const categories = [
    ...CATEGORY_ORDER.filter(c => groupedItems[c]),
    ...Object.keys(groupedItems).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  const checkedCount = groceryList.items.filter(i => i.checked).length;
  const totalCount = groceryList.items.length;

  return (
    <FlatList
      data={categories}
      keyExtractor={(category) => category}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={styles.progressBar}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressCount}>{checkedCount}/{totalCount}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${(checkedCount / totalCount) * 100}%` as any }]}
            />
          </View>
        </View>
      }
      renderItem={({ item: category }) => (
        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>{capitalized(category)}</Text>
          {groupedItems[category].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.itemRow, item.checked && styles.itemRowChecked]}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                {item.checked && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, item.checked && styles.checkedText]}>
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
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
  listContent: {
    padding: 16,
    backgroundColor: colors.background,
    paddingBottom: 32,
  },
  progressBar: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.foregroundSecondary,
    fontWeight: '500',
  },
  progressCount: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foregroundMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radii.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowElevations.sm,
  },
  itemRowChecked: {
    opacity: 0.6,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
  checkedText: {
    textDecorationLine: 'line-through',
    color: colors.foregroundMuted,
  },
  itemQuantity: {
    fontSize: 13,
    color: colors.foregroundMuted,
  },
});
