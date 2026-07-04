import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants';

export default function BuyCreditsScreen() {
  const router = useRouter();
  const { session, profile, fetchProfile } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [creditsToBuy, setCreditsToBuy] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Listen for transaction status changes via Supabase Realtime
  useEffect(() => {
    if (!transactionId) return;

    const channel = supabase.channel(`public:transactions:id=eq.${transactionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `id=eq.${transactionId}`
      }, (payload) => {
        const newStatus = payload.new.status;
        if (newStatus === 'completed') {
          setIsProcessing(false);
          Alert.alert("Success!", "Payment received. You now have 1 new credit!", [
            { text: "Awesome", onPress: () => {
              if (session?.user.id) fetchProfile(session.user.id);
              router.back();
            }}
          ]);
        } else if (newStatus === 'failed') {
          setIsProcessing(false);
          Alert.alert("Payment Failed", "The payment was cancelled or failed.");
          setTransactionId(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId]);

  const handlePayment = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      Alert.alert("Invalid Phone", "Please enter a valid mobile money number.");
      return;
    }
    
    setIsProcessing(true);
    try {
      // Note: Edge function URLs should match your Supabase project
      // For local testing, we might call it directly or use Supabase functions client
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { phoneNumber, credits: creditsToBuy }
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error(data?.error || "Payment initiation failed");

      setTransactionId(data.transactionId);
      const totalAmount = parseInt(creditsToBuy) * 500;
      Alert.alert("Check Your Phone", `Please enter your Mobile Money PIN on your phone to complete the purchase of ${totalAmount} TZS.`);
      
    } catch (e: any) {
      setIsProcessing(false);
      Alert.alert("Error", e.message);
    }
  };

  const handleVerifyPayments = async () => {
    setIsProcessing(true);
    try {
      if (!session?.user.id) return;
      
      const { data: pendingTxs, error: fetchError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'pending');
        
      if (fetchError) throw fetchError;
      
      if (!pendingTxs || pendingTxs.length === 0) {
        Alert.alert("All Good", "You don't have any pending or missing payments to recover.");
        setIsProcessing(false);
        return;
      }
      
      let recovered = 0;
      for (const tx of pendingTxs) {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { transactionId: tx.id }
        });
        if (data?.success && data.message.includes('awarded')) {
          recovered++;
        }
      }
      
      if (recovered > 0) {
        if (session.user.id) fetchProfile(session.user.id);
        Alert.alert("Success!", `We found and recovered ${recovered} missing payment(s)! Your credits have been updated.`);
      } else {
        Alert.alert("Status", "We checked your pending payments but none of them have been successfully completed on ClickPesa yet.");
      }
      
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to verify payments");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Credits</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          
          <View style={styles.balanceCard}>
            <Ionicons name="diamond" size={32} color={COLORS.gold} />
            <Text style={styles.balanceTitle}>Current Balance</Text>
            <Text style={styles.balanceAmount}>{profile?.credits || 0} Credits</Text>
            
            <TouchableOpacity onPress={handleVerifyPayments} disabled={isProcessing} style={styles.verifyBtn}>
              <Ionicons name="refresh-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.verifyText}>Verify Missing Payments</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.packageCard}>
            <View style={styles.packageHeader}>
              <Text style={styles.packageTitle}>Need more credits?</Text>
            </View>
            <Text style={styles.packageDesc}>Generate fully produced songs or upload custom audio. 1 Credit = 500 TZS (Equivalent to 2 full songs!).</Text>
            
            <View style={styles.divider} />

            <Text style={styles.label}>How many credits?</Text>
            <View style={[styles.inputRow, { marginBottom: 16 }]}>
              <Ionicons name="diamond" size={20} color={COLORS.gold} />
              <TextInput 
                style={styles.input} 
                placeholder="Number of credits (e.g. 2)" 
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
                value={creditsToBuy}
                onChangeText={setCreditsToBuy}
                editable={!isProcessing}
              />
            </View>
            
            <Text style={styles.label}>Pay with Mobile Money <Text style={{ color: COLORS.gold, fontSize: 12 }}>(Airtel & Halopesa only)</Text></Text>
            <View style={styles.inputRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={COLORS.gold} />
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 0754000000" 
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                editable={!isProcessing}
              />
            </View>

            <TouchableOpacity 
              style={[styles.payBtn, isProcessing && { opacity: 0.7 }]} 
              onPress={handlePayment} 
              disabled={isProcessing}
            >
              {isProcessing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={COLORS.black} />
                  <Text style={styles.payBtnText}>Waiting for PIN...</Text>
                </View>
              ) : (
                <Text style={styles.payBtnText}>Pay {(parseInt(creditsToBuy) || 1) * 500} TZS</Text>
              )}
            </TouchableOpacity>

            <View style={styles.secureWrap}>
              <Ionicons name="lock-closed" size={14} color={COLORS.textTertiary} />
              <Text style={styles.secureText}>Secured by ClickPesa</Text>
            </View>
          </View>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  content: { padding: 16 },
  balanceCard: { alignItems: 'center', backgroundColor: COLORS.card, padding: 24, borderRadius: 16, marginBottom: 24 },
  balanceTitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 12, marginBottom: 4 },
  balanceAmount: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900' },
  packageCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.gold + '40' },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  packageTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  packagePrice: { color: COLORS.gold, fontSize: 18, fontWeight: '900' },
  packageDesc: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 20 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
  payBtn: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  payBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  secureWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  secureText: { color: COLORS.textTertiary, fontSize: 12 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.background, borderRadius: 20 },
  verifyText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' }
});
