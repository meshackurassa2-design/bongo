import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants';

const PACKAGES = [
  { id: 'small', credits: 120, songs: 10, price: '3,200 TSH', oldPrice: null, saveText: null, popular: false },
  { id: 'medium', credits: 600, songs: 50, price: '14,500 TSH', oldPrice: '16,000', saveText: 'SAVE 10%', popular: true },
  { id: 'large', credits: 1200, songs: 100, price: '26,500 TSH', oldPrice: '32,000', saveText: 'SAVE 17%', popular: false },
];

export default function BuyCreditsScreen() {
  const router = useRouter();
  const { session, profile, fetchProfile } = useAuthStore();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handlePurchase = async (pkg: typeof PACKAGES[0]) => {
    if (!session?.user) {
      Alert.alert("Error", "You must be logged in to buy credits.");
      return;
    }

    setProcessingId(pkg.id);
    
    // Simulate payment gateway delay (Dummy Payment UI)
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const { data, error } = await supabase.rpc('add_credits', { 
        user_id: session.user.id, 
        amount: pkg.credits 
      });

      if (error) throw error;

      // Refresh profile to update balance
      await fetchProfile(session.user.id);
      
      Alert.alert(
        "Purchase Successful!", 
        `You have successfully purchased ${pkg.credits} credits.`,
        [{ text: "Awesome", onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert("Purchase Failed", error.message || "An unknown error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store</Text>
        <View style={styles.balanceBadge}>
          <Ionicons name="diamond" size={14} color={COLORS.gold} />
          <Text style={styles.balanceText}>{profile?.credits || 0}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[COLORS.goldLight, COLORS.goldDark]}
            style={styles.heroIcon}
          >
            <Ionicons name="diamond" size={48} color={COLORS.black} />
          </LinearGradient>
          <Text style={styles.heroTitle}>Get More Credits</Text>
          <Text style={styles.heroSub}>Generate incredible AI songs. Each song costs 12 credits.</Text>
        </View>

        <View style={styles.packagesContainer}>
          {PACKAGES.map((pkg) => (
            <TouchableOpacity 
              key={pkg.id} 
              style={[styles.packageCard, pkg.popular && styles.packageCardPopular]}
              onPress={() => handlePurchase(pkg)}
              disabled={processingId !== null}
            >
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}
              
              <View style={styles.packageInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="diamond" size={20} color={COLORS.gold} />
                  <Text style={styles.creditAmount}>{pkg.credits}</Text>
                </View>
                <Text style={styles.creditLabel}>{pkg.songs} Songs</Text>
              </View>

              <View style={styles.priceContainer}>
                <View style={styles.priceTopRow}>
                  {pkg.saveText && <Text style={styles.saveTextInline}>{pkg.saveText}</Text>}
                  {pkg.oldPrice && <Text style={styles.oldPrice}>{pkg.oldPrice}</Text>}
                </View>
                <View style={styles.priceBtn}>
                  {processingId === pkg.id ? (
                    <ActivityIndicator color={COLORS.black} size="small" />
                  ) : (
                    <Text style={styles.priceText}>{pkg.price}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  balanceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  balanceText: { color: COLORS.gold, fontSize: 13, fontWeight: 'bold' },
  content: { padding: 24 },
  heroSection: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  heroIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  heroSub: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },
  packagesContainer: { gap: 16 },
  packageCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.divider },
  packageCardPopular: { borderColor: COLORS.gold, backgroundColor: '#2a2211' },
  popularBadge: { position: 'absolute', top: -10, left: '50%', transform: [{ translateX: -45 }], backgroundColor: COLORS.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  popularText: { color: COLORS.black, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  packageInfo: { gap: 4 },
  creditAmount: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  creditLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceContainer: { alignItems: 'flex-end', gap: 6 },
  priceTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  saveTextInline: { color: COLORS.gold, fontSize: 11, fontWeight: '800' },
  oldPrice: { color: COLORS.textTertiary, fontSize: 12, textDecorationLine: 'line-through', fontWeight: '600' },
  priceBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, minWidth: 90, alignItems: 'center' },
  priceText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
});
