import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, ThemeType } from '../../store/themeStore';
import { THEMES } from '../../constants';

export default function ThemeSettingsScreen() {
  const { theme, setTheme, COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();

  const themes: { id: ThemeType; name: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
    { id: 'luxury', name: 'Luxury Gold', icon: 'diamond', description: 'The classic Bongo Stream premium dark theme.' },
    { id: 'love', name: 'Love & Romance', icon: 'heart', description: 'Crimson red and hot pink vibes.' },
    { id: 'ocean', name: 'Deep Ocean', icon: 'water', description: 'Relaxing cyan and deep midnight blues.' },
    { id: 'cyberpunk', name: 'Neon Cyberpunk', icon: 'flash', description: 'Vibrant neon magenta and cyan.' },
    { id: 'forest', name: 'Mystic Forest', icon: 'leaf', description: 'Earthy greens and dark nature tones.' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'App Theme',
          headerStyle: { backgroundColor: COLORS.darkSurface },
          headerTintColor: COLORS.textPrimary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 20 }}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerText}>Choose your vibe.</Text>
        <Text style={styles.subText}>Select a theme to instantly change the look and feel of Bongo Stream.</Text>

        <View style={styles.themeList}>
          {themes.map((t) => {
            const isActive = theme === t.id;
            const themeColors = THEMES[t.id];
            
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.themeCard, isActive && { borderColor: themeColors.gold, backgroundColor: themeColors.cardAlt }]}
                onPress={() => setTheme(t.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: themeColors.cardAlt }]}>
                  <Ionicons name={t.icon} size={28} color={themeColors.gold} />
                </View>
                <View style={styles.themeInfo}>
                  <Text style={styles.themeName}>{t.name}</Text>
                  <Text style={styles.themeDesc}>{t.description}</Text>
                  
                  {/* Palette preview */}
                  <View style={styles.paletteRow}>
                    <View style={[styles.colorDot, { backgroundColor: themeColors.black }]} />
                    <View style={[styles.colorDot, { backgroundColor: themeColors.card }]} />
                    <View style={[styles.colorDot, { backgroundColor: themeColors.gold }]} />
                    <View style={[styles.colorDot, { backgroundColor: themeColors.textPrimary }]} />
                  </View>
                </View>
                
                <View style={styles.radio}>
                  {isActive && <View style={[styles.radioInner, { backgroundColor: themeColors.gold }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  content: { padding: 20, paddingTop: 80 },
  headerText: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subText: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 32, lineHeight: 22 },
  
  themeList: { gap: 16 },
  themeCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.card, 
    padding: 16, 
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  themeInfo: { flex: 1 },
  themeName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  themeDesc: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 12 },
  
  paletteRow: { flexDirection: 'row', gap: 6 },
  colorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.textSecondary, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  radioInner: { width: 12, height: 12, borderRadius: 6 }
});
