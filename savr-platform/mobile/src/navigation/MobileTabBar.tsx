import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadowElevations, spacing } from '../theme';
import type { MainTabParamList } from './MainNavigator';

const tabConfig: Record<keyof MainTabParamList, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  Home: { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  Inventory: { label: 'Pantry', icon: 'file-tray-full-outline', activeIcon: 'file-tray-full' },
  Recipes: { label: 'Recipes', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  MealPlans: { label: 'Plans', icon: 'calendar-outline', activeIcon: 'calendar' },
  Profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
};

export default function MobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = tabConfig[route.name as keyof MainTabParamList];
          const iconName = isFocused ? config.activeIcon : config.icon;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
            >
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                <Ionicons name={iconName} size={20} color={isFocused ? colors.primaryForeground : colors.foregroundMuted} />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>{config.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabBar: {
    minHeight: spacing.navHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 10,
    ...shadowElevations.md,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foregroundMuted,
  },
  labelActive: {
    color: colors.foreground,
  },
});
