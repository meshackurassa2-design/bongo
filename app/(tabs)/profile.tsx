import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const signOut = useAuthStore(s => s.signOut);
  const { t } = useTranslation();

  if (!session || !profile) {
    return (
      <View style={styles.noAuth}>
        <Ionicons name="person-circle" size={80} color={COLORS.textSecondary} />
        <Text style={styles.noAuthTitle}>{t('profile.my_account')}</Text>
        <Text style={styles.noAuthText}>{t('profile.login_prompt')}</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth')}>
          <Text style={styles.loginBtnText}>{t('profile.login_btn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out'), t('profile.confirm_sign_out'), [
      { text: t('profile.no'), style: 'cancel' },
      { text: t('profile.yes_sign_out'), style: 'destructive', onPress: () => { signOut(); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="musical-notes" size={40} color={COLORS.gold} />
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.is_verified && <Text style={styles.verified}><Ionicons name="checkmark-circle" size={12} color={COLORS.gold} /> {t('profile.verified')}</Text>}

        <View style={styles.statsRow}>
          <StatItem label={t('profile.followers')} value={profile.follower_count} />
          <View style={styles.statDivider} />
          <StatItem label={t('profile.following')} value={profile.following_count} />
          <View style={styles.statDivider} />
          <StatItem label={t('profile.songs')} value={profile.track_count} />
          <View style={styles.statDivider} />
          <StatItem label="Credits" value={profile.credits || 0} />
        </View>
      </View>

      {/* Role badge */}
      <View style={[styles.roleBadge, { borderColor: (profile.role === 'artist' || profile.role === 'admin') ? COLORS.gold : COLORS.textTertiary }]}>
        <Ionicons name={profile.role === 'admin' ? 'shield-checkmark' : profile.role === 'artist' ? 'mic' : 'headset'} size={16} color={(profile.role === 'artist' || profile.role === 'admin') ? COLORS.gold : COLORS.textSecondary} />
        <Text style={[styles.roleText, { color: (profile.role === 'artist' || profile.role === 'admin') ? COLORS.gold : COLORS.textSecondary }]}>
          {profile.role === 'admin' ? 'Admin' : profile.role === 'artist' ? t('profile.artist') : t('profile.listener')}
        </Text>
      </View>

      {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      {profile.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={COLORS.textTertiary} />
          <Text style={styles.location}>{profile.location}</Text>
        </View>
      )}

      {/* Primary Actions Group */}
      <View style={styles.settingsGroup}>
        {profile.role === 'admin' && (
          <>
            <MenuRow icon="settings" label="Admin System Settings" iconColor={COLORS.error} onPress={() => router.push('/admin/settings')} />
            <MenuRow icon="shield-checkmark" label="Admin Panel: Manage Tickets" iconColor={COLORS.error} onPress={() => router.push('/admin/tickets')} />
          </>
        )}
        {(profile.role === 'artist' || profile.role === 'admin') && (
          <MenuRow icon="stats-chart" label="Artist Analytics Dashboard" iconColor={COLORS.gold} onPress={() => router.push('/artist/dashboard')} />
        )}
        {profile.role !== 'artist' && profile.role !== 'admin' && (
          <MenuRow icon="star" label="Become an Artist" iconColor={COLORS.gold} onPress={() => router.push('/settings/become-artist')} />
        )}
        <MenuRow icon="diamond" label="Buy Credits" iconColor={COLORS.gold} onPress={() => router.push('/buy-credits')} />
        <MenuRow icon="library-outline" label={t('tabs.library') || "My Library"} iconColor={COLORS.textPrimary} onPress={() => router.push('/library')} />
        <MenuRow icon="person-outline" label={t('profile.edit_profile')} iconColor={COLORS.textPrimary} onPress={() => router.push('/settings/edit-profile')} isLast />
      </View>

      {/* Settings section */}
      <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
      <View style={styles.settingsGroup}>
        <MenuRow icon="notifications-outline" label={t('profile.notifications')} iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/notifications')} />
        <MenuRow icon="language-outline" label={t('settings.language')} iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/language')} />
        <MenuRow icon="headset-outline" label="Help & Support" iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/support')} />
        <MenuRow icon="information-circle-outline" label={t('profile.about')} iconColor={COLORS.textSecondary} onPress={() => router.push('/settings/about')} isLast />
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress, iconColor, isLast }: { icon: string; label: string; onPress: () => void, iconColor: string, isLast?: boolean }) {
  return (
    <TouchableOpacity style={[styles.menuRow, isLast && styles.menuRowLast]} onPress={onPress}>
      <View style={styles.menuIconBox}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatarContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 3, borderColor: COLORS.gold },
  displayName: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  username: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  verified: { color: COLORS.gold, fontSize: 12, fontWeight: '700', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 20, backgroundColor: COLORS.card, borderRadius: 16, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.divider },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 12 },
  roleText: { fontSize: 13, fontWeight: '600' },
  bio: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginHorizontal: 24, marginTop: 12, lineHeight: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  location: { color: COLORS.textTertiary, fontSize: 13 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginHorizontal: 24, marginTop: 32, marginBottom: 8 },
  settingsGroup: { backgroundColor: COLORS.card, borderRadius: 20, marginHorizontal: 16, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.divider },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  menuRowLast: { borderBottomWidth: 0 },
  menuIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 32, padding: 16, borderRadius: 20, backgroundColor: 'rgba(255, 60, 60, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 60, 60, 0.3)', gap: 8 },
  signOutText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },
  noAuth: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAuthTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  noAuthText: { color: COLORS.textSecondary, fontSize: 14 },
  loginBtn: { backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  loginBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
});
