import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getApiCreditBalance } from '../../lib/sunoApi';
import { useThemeStore } from '../../store/themeStore';


export default function AdminSettingsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const [apiCredits, setApiCredits] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [kieKey, setKieKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'suno' | 'kie'>('suno');
  const [savingKey, setSavingKey] = useState(false);
  const [promoteUsername, setPromoteUsername] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [creditsRes, keyRes, kieRes, providerRes] = await Promise.all([
        getApiCreditBalance().catch(() => null),
        supabase.from('system_settings').select('value').eq('key', 'suno_api_key').single(),
        supabase.from('system_settings').select('value').eq('key', 'kie_api_key').single(),
        supabase.from('system_settings').select('value').eq('key', 'ai_api_provider').single(),
      ]);

      if (creditsRes !== null) {
        setApiCredits(creditsRes);
      }
      if (keyRes && keyRes.data) {
        setApiKey(keyRes.data.value);
      }
      if (kieRes && kieRes.data) {
        setKieKey(kieRes.data.value);
      }
      if (providerRes && providerRes.data) {
        setAiProvider(providerRes.data.value as 'suno' | 'kie');
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      const [sunoErr, kieErr, provErr] = await Promise.all([
        supabase.from('system_settings').update({ value: apiKey.trim(), updated_at: new Date().toISOString() }).eq('key', 'suno_api_key'),
        supabase.from('system_settings').update({ value: kieKey.trim(), updated_at: new Date().toISOString() }).eq('key', 'kie_api_key'),
        supabase.from('system_settings').update({ value: aiProvider, updated_at: new Date().toISOString() }).eq('key', 'ai_api_provider')
      ]);
      
      if (sunoErr.error) throw sunoErr.error;
      if (kieErr.error) throw kieErr.error;
      if (provErr.error) throw provErr.error;
      Alert.alert('Success', 'API Settings updated successfully! The app will now use the selected provider.');
      
      const credits = await getApiCreditBalance().catch(() => null);
      if (credits !== null) setApiCredits(credits);
      
    } catch (err: any) {
      Alert.alert('Error updating settings', err.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteUsername.trim()) return;
    setPromoting(true);
    try {
      const { data, error } = await supabase.rpc('promote_to_admin', { p_username: promoteUsername.trim().toLowerCase() });
      if (error) throw error;
      
      if (data === 'Success') {
        Alert.alert('Success', `@${promoteUsername.trim()} has been promoted to Admin!`);
        setPromoteUsername('');
      } else {
        Alert.alert('Error', data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setPromoting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : (
          <View>
            {/* Manage Events Navigation */}
            <TouchableOpacity 
              style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }]}
              onPress={() => router.push('/admin/events')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar" size={24} color={COLORS.gold} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' }}>Manage Events</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Add, view, or delete upcoming events</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>

            {/* Event Ticket Sales */}
            <TouchableOpacity 
              style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }]}
              onPress={() => router.push('/admin/event-tickets')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="ticket" size={24} color={COLORS.gold} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' }}>Event Ticket Sales</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>View RSVPs and scan tickets</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>

            {/* API Stats & Settings */}
            <View style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="flash" size={24} color={apiCredits !== null && apiCredits <= 10 ? COLORS.error : COLORS.gold} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.sectionTitle}>API Credits Remaining ({aiProvider === 'suno' ? 'Suno' : 'KIE'})</Text>
                  <Text style={[styles.statsValue, apiCredits !== null && apiCredits <= 10 && { color: COLORS.error }]}>
                    {apiCredits !== null ? apiCredits.toLocaleString() : '---'} {apiCredits !== null && apiCredits <= 10 && '(Running Low!)'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Active AI Provider</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 16 }}>
                <TouchableOpacity 
                  style={[styles.providerBtn, aiProvider === 'suno' && styles.providerBtnActive, { borderColor: COLORS.gold }]}
                  onPress={() => setAiProvider('suno')}
                >
                  <Text style={[styles.providerBtnText, aiProvider === 'suno' && { color: COLORS.black }]}>Suno API</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.providerBtn, aiProvider === 'kie' && styles.providerBtnActive, { borderColor: COLORS.gold }]}
                  onPress={() => setAiProvider('kie')}
                >
                  <Text style={[styles.providerBtnText, aiProvider === 'kie' && { color: COLORS.black }]}>KIE AI</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Suno API Key</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 12 }}>
                <TextInput 
                  style={styles.input} 
                  value={apiKey} 
                  onChangeText={setApiKey} 
                  placeholder="Enter Suno API Key..." 
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>

              <Text style={styles.sectionTitle}>KIE AI API Key</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 12 }}>
                <TextInput 
                  style={styles.input} 
                  value={kieKey} 
                  onChangeText={setKieKey} 
                  placeholder="Enter KIE API Key..." 
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={handleSaveKey} disabled={savingKey}>
                {savingKey ? <ActivityIndicator color={COLORS.black} size="small" /> : <Text style={styles.actionBtnText}>Save API Settings</Text>}
              </TouchableOpacity>
            </View>

            {/* Promote Admin Setting */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Promote a User to Admin</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TextInput 
                  style={styles.input} 
                  value={promoteUsername} 
                  onChangeText={setPromoteUsername} 
                  placeholder="Username (e.g. dapaz)" 
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.actionBtn} onPress={handlePromote} disabled={promoting}>
                  {promoting ? <ActivityIndicator color={COLORS.black} size="small" /> : <Text style={styles.actionBtnText}>Promote</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  sectionCard: { backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  statsValue: { color: COLORS.gold, fontSize: 18, fontWeight: '800' },
  input: { flex: 1, backgroundColor: COLORS.card, color: COLORS.textPrimary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.divider, fontSize: 14 },
  actionBtn: { backgroundColor: COLORS.gold, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  actionBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 14 },
  providerBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  providerBtnActive: { backgroundColor: COLORS.gold },
  providerBtnText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 },
});
