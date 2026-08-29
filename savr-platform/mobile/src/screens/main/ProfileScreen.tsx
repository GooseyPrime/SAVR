import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSubscriptionPlanLabel,
  getSubscriptionStatusLabel,
  hasProAccess,
  isSubscriptionActive,
} from '../../lib/billing';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadowElevations } from '../../theme/index';

const APP_URL = 'https://savr.cam';

export default function ProfileScreen() {
  const { user, userData, signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  const isProPlan = userData?.subscriptionTier === 'pro';
  const hasActiveSubscription = isSubscriptionActive(userData?.subscriptionStatus);
  const isPro = hasProAccess(userData);
  const displayName = userData?.displayName || user?.email?.split('@')[0] || 'Chef';
  const tierLabel = getSubscriptionPlanLabel(userData?.subscriptionTier);
  const statusLabel = getSubscriptionStatusLabel(userData?.subscriptionStatus);
  const isPlanKnown = tierLabel !== 'Unavailable';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={44} color={colors.primaryForeground} />
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.tierBadge, isPro && styles.tierBadgePro]}>
          <Text style={[styles.tierText, isPro && styles.tierTextPro]}>
            {isPlanKnown ? `${isProPlan ? '⭐' : '📦'} ${tierLabel}` : 'Subscription unavailable'}
          </Text>
        </View>
      </View>

      {/* Account section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {/*
          Google Play Payments policy: this app sells nothing and must not
          direct users to an outside purchase flow. Plan state is shown as
          information only — no purchase control, no link to checkout.
        */}
        <View style={[styles.menuItem, styles.planItem]}>
          <Ionicons
            name={isPro ? 'star' : 'star-outline'}
            size={22}
            color={isPro ? colors.primary : colors.foregroundMuted}
          />
          <Text style={styles.menuItemText}>Current plan</Text>
          <Text style={[styles.planValue, !isPlanKnown && styles.planValueMuted]}>{tierLabel}</Text>
        </View>

        <View style={[styles.menuItem, styles.menuItemLast]}>
          <Ionicons
            name={hasActiveSubscription ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={22}
            color={hasActiveSubscription ? colors.primary : colors.foregroundMuted}
          />
          <Text style={styles.menuItemText}>Subscription status</Text>
          <Text style={[styles.statusValue, !hasActiveSubscription && styles.planValueMuted]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Support section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL(`${APP_URL}/help`)}>
          <Ionicons name="help-circle-outline" size={22} color={colors.foregroundMuted} />
          <Text style={styles.menuItemText}>Help Center</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('mailto:support@savr.cam')}>
          <Ionicons name="mail-outline" size={22} color={colors.foregroundMuted} />
          <Text style={styles.menuItemText}>Contact Support</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL(`${APP_URL}/privacy`)}>
          <Ionicons name="document-text-outline" size={22} color={colors.foregroundMuted} />
          <Text style={styles.menuItemText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={() => Linking.openURL(`${APP_URL}/terms`)}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.foregroundMuted} />
          <Text style={styles.menuItemText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.foregroundMuted} />
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

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
    paddingBottom: 48,
  },
  profileHeader: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    ...shadowElevations.md,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.foregroundMuted,
    marginBottom: 12,
  },
  tierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierBadgePro: {
    backgroundColor: colors.primaryLight,
    borderColor: `${colors.primary}44`,
  },
  tierText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foregroundSecondary,
  },
  tierTextPro: {
    color: colors.primary,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadowElevations.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foregroundMuted,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  menuItemLast: {},
  planItem: {
    backgroundColor: colors.primaryLight,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  planValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  planValueMuted: {
    color: colors.foregroundMuted,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.error}44`,
    backgroundColor: colors.errorLight,
  },
  signOutText: {
    fontSize: 15,
    color: colors.error,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.foregroundMuted,
    marginTop: 20,
  },
});
