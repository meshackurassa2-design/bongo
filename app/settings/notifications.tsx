import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';

import { useTranslation } from 'react-i18next';

export default function NotificationsSettings() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('profile.notifications'), headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
      
      <View style={styles.row}>
        <Text style={styles.label}>{t('settings.push_notifs')}</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: COLORS.divider, true: COLORS.gold }}
          thumbColor={COLORS.white}
        />
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 16, borderRadius: 12 },
  label: { color: COLORS.textPrimary, fontSize: 16 }
});
