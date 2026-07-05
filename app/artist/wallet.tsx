import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';

import { useAuthStore } from '../../store/authStore';

export default function ArtistWalletScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const profile = useAuthStore(s => s.profile);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    if (!profile) return;
    setLoading(true);

    // Fetch updated profile
    const { data: userProfile } = await supabase.from('profiles').select('earnings_balance, phone_number').eq('id', profile.id).single();
    if (userProfile) {
      setEarnings(userProfile.earnings_balance || 0);
      setPhoneNumber(userProfile.phone_number || '');
    }

    // Fetch payouts
    const { data: requests } = await supabase.from('payout_requests').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    if (requests) {
      setPayouts(requests);
    }

    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (earnings < 50000) {
      Alert.alert("Minimum Payout", "You need at least 50,000 TZS in earnings to withdraw.");
      return;
    }

    if (!phoneNumber) {
      Alert.alert("Required", "Please enter your Mobile Money phone number.");
      return;
    }

    Alert.alert(
      "Confirm Withdrawal",
      `Are you sure you want to withdraw ${earnings.toLocaleString()} TZS to ${phoneNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            setSubmitting(true);
            
            // First update the phone number in profiles
            await supabase.from('profiles').update({ phone_number: phoneNumber }).eq('id', profile!.id);

            // Request payout
            const { error } = await supabase.rpc('request_payout', {
              p_amount: earnings,
              p_phone_number: phoneNumber
            });

            if (error) {
              Alert.alert("Error", error.message);
            } else {
              Alert.alert("Success", "Your payout request has been submitted and is processing!");
              loadWallet();
            }
            setSubmitting(false);
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Artist Wallet', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Artist Wallet', headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold, headerBackTitleVisible: false }} />
      
      <View style={styles.headerArea}>
        <Text style={styles.label}>Available Earnings</Text>
        <Text style={styles.balance}>{earnings.toLocaleString()} TZS</Text>
        <Text style={styles.subtext}>Earned from Tips and Song Battles</Text>
      </View>

      <View style={styles.withdrawCard}>
        <Text style={styles.cardTitle}>Withdraw Funds</Text>
        
        <Text style={styles.inputLabel}>Mobile Money Number (M-Pesa / Tigo Pesa)</Text>
        <TextInput 
          style={styles.input}
          placeholder="e.g. 0754 000 000"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <TouchableOpacity 
          style={[styles.withdrawBtn, earnings < 50000 && styles.withdrawBtnDisabled]} 
          onPress={handleWithdraw}
          disabled={earnings < 50000 || submitting}
        >
          {submitting ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.withdrawBtnText}>Withdraw All</Text>}
        </TouchableOpacity>
        
        {earnings < 50000 && (
          <Text style={styles.warningText}>Minimum withdrawal is 50,000 TZS.</Text>
        )}
      </View>

      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Payout History</Text>
        
        {payouts.length === 0 ? (
          <Text style={styles.emptyText}>No previous payouts.</Text>
        ) : (
          payouts.map(p => (
            <View key={p.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyAmount}>{p.amount.toLocaleString()} TZS</Text>
                <Text style={styles.historyDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={[
                styles.statusBadge, 
                p.status === 'completed' ? styles.statusSuccess : 
                p.status === 'rejected' ? styles.statusError : 
                styles.statusPending
              ]}>
                <Text style={[
                  styles.statusText,
                  p.status === 'completed' ? styles.statusTextSuccess : 
                  p.status === 'rejected' ? styles.statusTextError : 
                  styles.statusTextPending
                ]}>{p.status.toUpperCase()}</Text>
              </View>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  headerArea: { alignItems: 'center', marginVertical: 32 },
  label: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  balance: { color: COLORS.gold, fontSize: 42, fontWeight: '900' },
  subtext: { color: COLORS.textTertiary, fontSize: 13, marginTop: 8 },
  
  withdrawCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider, marginBottom: 32 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8 },
  input: { backgroundColor: COLORS.black, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.divider, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  withdrawBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center' },
  withdrawBtnDisabled: { backgroundColor: COLORS.cardAlt },
  withdrawBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
  warningText: { color: COLORS.error, fontSize: 12, textAlign: 'center', marginTop: 12 },
  
  historySection: { marginBottom: 40 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  emptyText: { color: COLORS.textTertiary, fontStyle: 'italic' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 12 },
  historyAmount: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  historyDate: { color: COLORS.textTertiary, fontSize: 13 },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '800' },
  
  statusSuccess: { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: '#4CAF50' },
  statusTextSuccess: { color: '#4CAF50' },
  
  statusError: { backgroundColor: 'rgba(255, 82, 82, 0.1)', borderColor: COLORS.error },
  statusTextError: { color: COLORS.error },
  
  statusPending: { backgroundColor: 'rgba(255, 184, 48, 0.1)', borderColor: COLORS.gold },
  statusTextPending: { color: COLORS.gold },
});
