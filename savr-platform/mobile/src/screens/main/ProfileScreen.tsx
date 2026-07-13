import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { isPaidTier } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadowElevations } from '../../theme/index';

const APP_URL = 'https://savr.cam';

interface MenuItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
  accent?: boolean;
  danger?: boolean;
}

function MenuItem({ icon, label, onPress, accent, danger }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconWrap, accent && styles.menuIconAccent, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={danger ? colors.error : accent ? colors.primary : colors.foregroundSecondary}
        />
      </View>
      <Text style={[styles.menuItemText, accent && styles.menuItemAccent, danger && styles.menuItemDanger]}>
        {label}
      </Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={colors.foregroundMuted} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, userData, signOut } = useAuth();
  const isPro = isPaidTier(userData?.subscriptionTier);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (_error) {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{userData?.displayName || 'Chef'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.badge, isPro && styles.badgePro]}>
          <Ionicons
            name={isPro ? 'star' : 'cube-outline'}
            size={13}
            color={isPro ? colors.primaryForeground : colors.foregroundMuted}
          />
          <Text style={[styles.badgeText, isPro && styles.badgeTextPro]}>
            {isPro ? 'Pro' : 'Basic'}
          </Text>
        </View>
      </View>

      {/* Upgrade banner for free users */}
      {!isPro && (
        <TouchableOpacity
          style={styles.upgradeBanner}
          onPress={() => Linking.openURL(`${APP_URL}/pricing`)}
          activeOpacity={0.8}
        >
          <View style={styles.upgradeBannerContent}>
            <Ionicons name="star" size={20} color={colors.primaryForeground} />
            <View style={styles.upgradeText}>
              <Text style={styles.upgradeBannerTitle}>Upgrade to Pro</Text>
              <Text style={styles.upgradeBannerSub}>Unlimited recipes, AI meal plans &amp; more</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      {/* Account section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuItem icon="person-outline" label="Edit Profile" />
        <MenuItem icon="key-outline" label="Change Password" />
      </View>

      {/* Preferences section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <MenuItem icon="notifications-outline" label="Notifications" />
        <MenuItem icon="language-outline" label="Language" />
        <MenuItem icon="color-palette-outline" label="Appearance" />
      </View>

      {/* Support section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <MenuItem icon="help-circle-outline" label="Help Center" onPress={() => Linking.openURL(`${APP_URL}/help`)} />
        <MenuItem icon="mail-outline" label="Contact Us" onPress={() => Linking.openURL('mailto:support@savr.cam')} />
        <MenuItem icon="document-text-outline" label="Privacy Policy" onPress={() => Linking.openURL(`${APP_URL}/privacy`)} />
        <MenuItem icon="shield-checkmark-outline" label="Terms of Service" onPress={() => Linking.openURL(`${APP_URL}/terms`)} />
      </View>

      {/* Sign out */}
      <View style={styles.section}>
        <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
      </View>

      <Text style={styles.version}>SAVR v1.0.0</Text>
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
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.foregroundMuted,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgePro: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foregroundSecondary,
  },
  badgeTextPro: {
    color: colors.primaryForeground,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    ...shadowElevations.md,
  },
  upgradeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  upgradeText: {
    flex: 1,
  },
  upgradeBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  upgradeBannerSub: {
    fontSize: 12,
    color: colors.primaryForeground,
    opacity: 0.8,
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foregroundMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconAccent: {
    backgroundColor: colors.primaryLight,
  },
  menuIconDanger: {
    backgroundColor: colors.errorLight,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    fontWeight: '500',
  },
  menuItemAccent: {
    color: colors.primary,
  },
  menuItemDanger: {
    color: colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.foregroundMuted,
    marginTop: 24,
  },
});
