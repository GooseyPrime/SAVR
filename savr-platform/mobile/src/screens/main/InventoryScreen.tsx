import React, { useEffect, useState } from 'react';
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
  ScrollView,
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
  image_url?: string;
}

const CATEGORIES = ['pantry', 'fridge', 'freezer', 'other'];

export default function InventoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<LocalInventoryItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '',
    unit: '',
    category: 'pantry',
  });

  useEffect(() => {
    loadInventory();
  }, [user]);

  const loadInventory = async () => {
    if (!user) return;

    try {
      const inventoryItems = await getInventory(user.id);
      setItems(inventoryItems);
    } catch (_error) {
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
            category: 'scanned',
            image_url: imageUrl,
          })
        );
        await Promise.all(addPromises);
        Alert.alert(
          'Scan Complete',
          `Found ${data.ingredients.length} item${data.ingredients.length !== 1 ? 's' : ''}. Added to your pantry.`
        );
        loadInventory();
      } else {
        Alert.alert('No Items Found', 'Could not detect food items in the photo. Try a clearer picture.');
      }
    } catch (error: any) {
      Alert.alert('Scan Error', error?.message || 'Failed to scan image');
    } finally {
      setScanning(false);
    }
  };

  const handleAddItem = async () => {
    if (!user || !newItem.name || !newItem.quantity) {
      Alert.alert('Error', 'Please fill in name and quantity');
      return;
    }

    try {
      setLoading(true);
      let imageUrl = '';
      if (imageUri) {
        imageUrl = await uploadImage(imageUri, user.id, Date.now().toString());
      }

      await addInventoryItem(user.id, {
        name: newItem.name,
        quantity: parseFloat(newItem.quantity),
        unit: newItem.unit || 'units',
        category: newItem.category || 'other',
        image_url: imageUrl,
      });

      setModalVisible(false);
      setNewItem({ name: '', quantity: '', unit: '', category: 'pantry' });
      setImageUri('');
      loadInventory();
    } catch (_error) {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    Alert.alert('Delete Item', 'Remove this item from your pantry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventoryItem(itemId);
            loadInventory();
          } catch (_error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter(i => i.category === activeCategory);

  if (loading && items.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {['all', ...CATEGORIES].map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, activeCategory === cat && styles.chipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemIconWrap}>
              <Ionicons name="cube-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity} {item.unit}
                {item.category ? ` · ${item.category}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeleteItem(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="file-tray-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>
              {activeCategory === 'all' ? 'Your pantry is empty' : `No ${activeCategory} items`}
            </Text>
            <Text style={styles.emptySubtext}>Scan with the camera or add manually</Text>
          </View>
        }
        contentContainerStyle={filteredItems.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      {/* Scan FAB */}
      <TouchableOpacity style={styles.scanFab} onPress={handleAIScan} disabled={scanning}>
        {scanning ? (
          <LoadingSpinner size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="camera" size={22} color={colors.primaryForeground} />
        )}
      </TouchableOpacity>

      {/* Add FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.foregroundMuted} />
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
              placeholder="Category (e.g., pantry, fridge)"
              placeholderTextColor={colors.foregroundMuted}
              value={newItem.category}
              onChangeText={(text) => setNewItem({ ...newItem, category: text })}
            />

            <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
              <Text style={styles.addButtonText}>Add to Pantry</Text>
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
  filterRow: {
    flexShrink: 0,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foregroundSecondary,
  },
  chipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
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
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.foregroundMuted,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radii.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowElevations.sm,
    gap: 12,
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 3,
  },
  itemDetails: {
    fontSize: 13,
    color: colors.foregroundMuted,
  },
  deleteBtn: {
    padding: 4,
  },
  scanFab: {
    position: 'absolute',
    bottom: 100,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 24,
    paddingTop: 12,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: colors.surface,
    color: colors.foreground,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: 6,
  },
  addButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
  },
});
