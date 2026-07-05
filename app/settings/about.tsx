import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';

import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

export default function AboutSettings() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('profile.about'), headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
      
      <View style={styles.header}>
        <Ionicons name="musical-notes" size={60} color={COLORS.gold} />
        <Text style={styles.appName}>Bongo Stream</Text>
        <Text style={styles.version}>{t('settings.version')} 1.0.0</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('settings.developer')}</Text>
        <Text style={styles.value}>Dapaz Company</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('settings.terms')}</Text>
        <TouchableOpacity onPress={() => router.push('/terms')} style={{ marginTop: 4 }}>
          <Text style={[styles.value, { color: COLORS.gold }]}>Read Terms & Conditions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  header: { alignItems: 'center', marginVertical: 32 },
  appName: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', marginTop: 12 },
  version: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 12 },
  label: { color: COLORS.textSecondary, fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  value: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 22 }
});
