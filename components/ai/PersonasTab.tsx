import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';

export default function PersonasTab() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="mic-outline" size={80} color={COLORS.gold} />
      </View>
      <Text style={styles.title}>Voice Personas</Text>
      <Text style={styles.subtitle}>
        We are building something incredible. Soon you will be able to extract and clone custom voice personas to sing any song in any style. 
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Coming Soon...</Text>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.black,
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  iconContainer: { 
    backgroundColor: 'rgba(212, 175, 55, 0.1)', 
    padding: 24, 
    borderRadius: 100, 
    marginBottom: 24 
  },
  title: { 
    color: COLORS.textPrimary, 
    fontSize: 28, 
    fontWeight: '900', 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  subtitle: { 
    color: COLORS.textSecondary, 
    fontSize: 16, 
    textAlign: 'center', 
    lineHeight: 24 
  },
  badge: { 
    marginTop: 32, 
    backgroundColor: 'rgba(212, 175, 55, 0.1)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 20 
  },
  badgeText: { 
    color: COLORS.gold, 
    fontSize: 16, 
    fontWeight: '700' 
  }
});
