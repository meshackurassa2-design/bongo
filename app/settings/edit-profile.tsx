import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function EditProfileSettings() {
  const profile = useAuthStore(s => s.profile);
  const router = useRouter();
  const { t } = useTranslation();
  
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName,
      bio,
      location
    }).eq('id', profile.id);
    
    setSaving(false);
    if (error) {
      Alert.alert(t('upload.error'), error.message);
    } else {
      useAuthStore.getState().fetchProfile();
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('profile.edit_profile'), headerShown: true, headerStyle: { backgroundColor: COLORS.black }, headerTintColor: COLORS.gold }} />
      
      <Text style={styles.label}>Display Name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholderTextColor={COLORS.textTertiary} />
      
      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} multiline placeholderTextColor={COLORS.textTertiary} />
      
      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholderTextColor={COLORS.textTertiary} />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.saveBtnText}>{t('settings.save')}</Text>}
      </TouchableOpacity>

      {profile?.role !== 'artist' && profile?.role !== 'admin' && (
        <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/settings/become-artist')}>
          <Ionicons name="star" size={20} color={COLORS.gold} />
          <Text style={styles.upgradeBtnText}>Upgrade to Artist Account</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, padding: 16 },
  label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, borderRadius: 12, padding: 14, fontSize: 15 },
  saveBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: COLORS.black, fontWeight: 'bold', fontSize: 16 },
  upgradeBtn: { backgroundColor: 'transparent', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: COLORS.gold },
  upgradeBtnText: { color: COLORS.gold, fontWeight: 'bold', fontSize: 16 }
});
