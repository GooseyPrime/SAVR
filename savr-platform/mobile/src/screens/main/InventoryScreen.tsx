import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import LoadingSpinner from '../../components/LoadingSpinner';
import ImagePickerComponent from '../../components/ImagePickerComponent';
import { uploadImage } from '../../utils/imageUtils';
import { getInventory, addInventoryItem, deleteInventoryItem } from '../../lib/db';
import { analyzeImage } from '../../utils/api';
import { colors, radii, shadowElevations } from '../../theme/index';

interface LocalInventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiry_date?: string | null;
  image_url?: string;
}

type CategoryFilter = 'all' | 'pantry' | 'fridge' | 'freezer';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  pantry: 'Pantry',
  fridge: 'Fridge',
  freezer: 'Freezer',
};

function isExpiringSoon(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  const now = new Date();
  const exp = new Date(expiryDate);
  const threeDays = new Date(now.getTime() + THREE_DAYS_MS);
  return exp >= now && exp <= threeDays;
}

function isExpired(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

export default function InventoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string>('');
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '',
    unit: '',
    category: '',
  });

  useEffect(() => {
    loadInventory();
  }, [user]);

  const loadInventory = async () => {
    if (!user) return;

    try {
      const inventoryItems = await getInventory(user.id);
      setItems(inventoryItems as LocalInventoryItem[]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInventory();
  };

  // Filtered items by search + category
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, activeCategory]);

  // Group filtered items by category/location
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const loc = item.category || 'pantry';
      if (!acc[loc]) acc[loc] = [];
      acc[loc].push(item);
      return acc;
    }, {} as Record<string, LocalInventoryItem[]>);
  }, [filteredItems]);

  // Expiring soon count across full list
  const expiringCount = useMemo(() => {
    return items.filter((item) => isExpiringSoon(item.expiry_date)).length;
  }, [items]);

  const handleAIScan = async () => {
    if (!user) return;

    try {
      setScanning(true);
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to scan pantry items.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) {
        setScanning(false);
        return;
      }

      const uri = result.assets[0].uri;
      const imageUrl = await uploadImage(uri, user.id, `scan_${Date.now()}`);
      const data = await analyzeImage(imageUrl);

      if (data.success && data.ingredients && data.ingredients.length > 0) {
        const addPromises = data.ingredients.map((ingredient: any) =>
          addInventoryItem(user.id, {
            name: ingredient.name,
            quantity: ingredient.quantity || 1,
            unit: ingredient.unit || 'units',
            category: ingredient.category === 'fridge' || ingredient.category === 'freezer' ? ingredient.category : 'pantry',
            image_url: imageUrl,
            notes: ingredient.notes,
            expiry_date: ingredient.expiryDate,
          })
        );
        await Promise.all(addPromises);
        Alert.alert(
          'Scan Complete',
          `Found ${data.ingredients.length} item${data.ingredients.length !== 1 ? 's' : ''}. Added to your pantry.`
        );
        loadInventory();
      } else {
        Alert.alert('No Items Found', 'Could not detect any food items. Try a clearer picture.');
      }
    } catch (error: any) {
      Alert.alert('Scan Error', error?.message || 'Failed to scan image');
    } finally {
      setScanning(false);
    }
  };

  const handleAddItem = async () => {
    if (!user || !newItem.name || !newItem.quantity) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    try {
      setLoading(true);
      let imageUrl = '';

      if (imageUri) {
        const itemId = Date.now().toString();
        imageUrl = await uploadImage(imageUri, user.id, itemId);
      }

      await addInventoryItem(user.id, {
        name: newItem.name,
        quantity: parseFloat(newItem.quantity),
        unit: newItem.unit || 'units',
        category: newItem.category || 'pantry',
        image_url: imageUrl,
      });

      setModalVisible(false);
      setNewItem({ name: '', quantity: '', unit: '', category: '' });
      setImageUri('');
      loadInventory();
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    Alert.alert('Remove Item', 'Remove this item from your pantry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventoryItem(itemId);
            loadInventory();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  if (loading && items.length === 0) {
    return <LoadingSpinner />;
  }

  const locationIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    pantry: 'cube-outline',
    fridge: 'snow-outline',
    freezer: 'thermometer-outline',
    scanned: 'camera-outline',
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.foregroundMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pantry..."
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

      {/* Category filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'pantry', 'fridge', 'freezer'] as CategoryFilter[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, activeCategory === cat && styles.chipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{items.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={styles.statNumber}>
            {new Set(items.map((i) => i.category)).size}
          </Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNumber, expiringCount > 0 && styles.statNumberWarning]}>
            {expiringCount}
          </Text>
          <Text style={styles.statLabel}>Expiring</Text>
        </View>
      </View>

      <FlatList
        data={Object.keys(groupedItems)}
        keyExtractor={(loc) => loc}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item: loc }) => {
          const LocIcon = locationIcons[loc] || 'cube-outline';
          return (
            <View style={styles.locationSection}>
              <View style={styles.locationHeader}>
                <Ionicons name={LocIcon as any} size={16} color={colors.primary} />
                <Text style={styles.locationTitle}>
                  {CATEGORY_LABELS[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)}
                </Text>
                <Text style={styles.locationCount}>({groupedItems[loc].length})</Text>
              </View>
              {groupedItems[loc].map((item) => {
                const expiring = isExpiringSoon(item.expiry_date);
                const expired = isExpired(item.expiry_date);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemCard,
                      expired && styles.itemCardExpired,
                      expiring && !expired && styles.itemCardExpiring,
                    ]}
                  >
                    <View style={styles.itemInfo}>
                      <View style={styles.itemNameRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {(expired || expiring) && (
                          <Ionicons
                            name="warning"
                            size={14}
                            color={expired ? colors.error : colors.warning}
                            style={{ marginLeft: 6 }}
                          />
                        )}
                      </View>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemDetails}>
                          {item.quantity} {item.unit}
                        </Text>
                        {item.expiry_date && (
                          <>
                            <Text style={styles.metaSep}>•</Text>
                            <Text
                              style={[
                                styles.expiryText,
                                expired ? styles.expiryExpired : expiring ? styles.expiryWarning : styles.expiryOk,
                              ]}
                            >
                              {expired
                                ? 'Expired'
                                : `Exp ${new Date(item.expiry_date).toLocaleDateString()}`}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(item.id)}
                      style={styles.deleteBtn}
                      accessibilityLabel={`Remove ${item.name}`}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.foregroundMuted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={56} color={colors.foregroundMuted} />
            <Text style={styles.emptyText}>
              {items.length === 0 ? 'Your pantry is empty' : 'No items match your search'}
            </Text>
            <Text style={styles.emptySubtext}>
              {items.length === 0
                ? 'Scan your ingredients to get started'
                : 'Try adjusting your search or filter'}
            </Text>
          </View>
        }
        contentContainerStyle={
          Object.keys(groupedItems).length === 0 ? styles.emptyContainer : styles.listContent
        }
      />

      {/* AI Scan FAB */}
      <TouchableOpacity style={styles.scanFab} onPress={handleAIScan} disabled={scanning}>
        {scanning ? (
          <LoadingSpinner size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="camera" size={26} color={colors.primaryForeground} />
        )}
      </TouchableOpacity>

      {/* Manual Add FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color={colors.primaryForeground} />
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ImagePickerComponent onImageSelected={setImageUri} currentImageUrl={imageUri} />

            <TextInput
              style={styles.input}
              placeholder="Item name *"
              placeholderTextColor={colors.foregroundMuted}
              value={newItem.name}
              onChangeText={(text) => setNewItem({ ...newItem, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Quantity *"
              placeholderTextColor={colors.foregroundMuted}
              value={newItem.quantity}
              onChangeText={(text) => setNewItem({ ...newItem, quantity: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Unit (e.g., cups, lbs)"
              placeholderTextColor={colors.foregroundMuted}
              value={newItem.unit}
              onChangeText={(text) => setNewItem({ ...newItem, unit: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Category (pantry, fridge, freezer)"
              placeholderTextColor={colors.foregroundMuted}
              value={newItem.category}
              onChangeText={(text) => setNewItem({ ...newItem, category: text })}
            />

            <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 10,
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
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
  },
  statNumberWarning: {
    color: colors.warning,
  },
  statLabel: {
    fontSize: 11,
    color: colors.foregroundMuted,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
  },
  locationSection: {
    marginBottom: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  locationCount: {
    fontSize: 12,
    color: colors.foregroundMuted,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    ...shadowElevations.sm,
  },
  itemCardExpiring: {
    borderColor: `${colors.warning}44`,
    backgroundColor: colors.warningLight,
  },
  itemCardExpired: {
    borderColor: `${colors.error}44`,
    backgroundColor: colors.errorLight,
  },
  itemInfo: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: colors.foregroundMuted,
  },
  metaSep: {
    fontSize: 13,
    color: colors.foregroundMuted,
  },
  expiryText: {
    fontSize: 12,
  },
  expiryOk: {
    color: colors.foregroundMuted,
  },
  expiryWarning: {
    color: colors.warning,
  },
  expiryExpired: {
    color: colors.error,
  },
  deleteBtn: {
    padding: 8,
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
  scanFab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadowElevations.md,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: colors.surfaceRaised,
    color: colors.foreground,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
