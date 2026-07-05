import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';

import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';

export default function LanguageSettings() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { t, i18n } = useTranslation();

  const setLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    await AsyncStorage.setItem('bongo_language', lng);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('settings.language'), headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
      <Text style={styles.subtitle}>{t('settings.select_language')}</Text>

      <TouchableOpacity style={styles.row} onPress={() => setLanguage('sw')}>
        <Text style={styles.label}>Kiswahili</Text>
        {i18n.language === 'sw' && <Ionicons name="checkmark" size={24} color={COLORS.gold} />}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.row} onPress={() => setLanguage('en')}>
        <Text style={styles.label}>English</Text>
        {i18n.language === 'en' && <Ionicons name="checkmark" size={24} color={COLORS.gold} />}
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 8 },
  label: { color: COLORS.textPrimary, fontSize: 16 }
});
