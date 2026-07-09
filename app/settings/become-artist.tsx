import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';


export default function BecomeArtistScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const fetchProfile = useAuthStore(s => s.fetchProfile);
  
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!agreed) {
      Alert.alert('Agreement Required', 'You must agree to the terms to become an artist.');
      return;
    }

    if (!session?.user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'artist' })
        .eq('id', session.user.id);

      if (error) throw error;

      await fetchProfile();

      Alert.alert(
        'Congratulations! 🎉', 
        'You are now an Artist! You can start uploading your own music to Bongo Stream.',
        [{ text: 'Start Uploading', onPress: () => router.replace('/upload') }]
      );
    } catch (err: any) {
      Alert.alert('Upgrade Failed', err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role === 'artist' || profile?.role === 'admin') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.gold} />
          <Text style={styles.title}>You are already an {profile.role}!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become an Artist</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mic" size={60} color={COLORS.gold} />
          <Text style={styles.title}>Upload Your Music</Text>
          <Text style={styles.subtitle}>
            Share your talent with the world. Upgrading to an Artist account is completely free and allows you to publish your own songs to Bongo Stream.
          </Text>
        </View>

        <View style={styles.termsBox}>
          <Text style={styles.termsTitle}>Artist Agreement</Text>
          <Text style={styles.termsText}>
            1. I confirm that I own the rights to all music I upload.{"\n"}
            2. I will not upload copyrighted material without permission.{"\n"}
            3. I understand that Bongo Stream reserves the right to remove content that violates these terms.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.checkboxRow} 
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Ionicons name="checkmark" size={16} color={COLORS.black} />}
          </View>
          <Text style={styles.checkboxText}>I agree to the Artist Terms & Conditions</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitBtn, (!agreed || loading) && styles.submitBtnDisabled]} 
          onPress={handleUpgrade}
          disabled={!agreed || loading}
        >
          <Text style={styles.submitBtnText}>
            {loading ? 'Upgrading...' : 'Upgrade My Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  termsBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 24,
  },
  termsTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  termsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  checkboxText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '800',
  },
});
