import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants';

export default function AuthScreen() {
  const router = useRouter();
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const isLoading = useAuthStore(s => s.isLoading);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isArtist, setIsArtist] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [vpwVisible, setVpwVisible] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { Alert.alert('Kosa', 'Jaza barua pepe na nywila'); return; }
    
    if (mode === 'signup') {
      if (!username.trim()) { Alert.alert('Kosa', 'Jaza jina la mtumiaji'); return; }
      if (password !== verifyPassword) { Alert.alert('Kosa', 'Nywila hazifanani'); return; }
      if (!acceptedTerms) { Alert.alert('Kosa', 'You must accept the Terms and Conditions'); return; }
    }

    let error: string | null;
    if (mode === 'login') {
      let loginEmail = email.trim();
      // If it doesn't have an @ symbol, assume it's a username and lookup the email securely
      if (!loginEmail.includes('@')) {
        const { data: fetchedEmail, error: rpcError } = await import('../lib/supabase').then(m => m.supabase.rpc('get_user_email', { p_username: loginEmail.toLowerCase() }));
        if (fetchedEmail) {
          loginEmail = fetchedEmail;
        } else {
          Alert.alert('Kosa', 'Jina la mtumiaji halijapatikana (Username not found)');
          return;
        }
      }
      error = await signIn(loginEmail, password);
    } else {
      error = await signUp(email.trim(), password, username.trim().toLowerCase(), displayName.trim() || username.trim(), isArtist ? 'artist' : 'fan');
    }

    if (error) {
      Alert.alert('Imeshindwa', error);
    }
    // No need for router.back() or replace('/') here.
    // Our root _layout.tsx will automatically redirect the user to '/'
    // as soon as the session state changes!
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <Ionicons name="musical-notes" size={56} color={COLORS.gold} />
        </View>
        <Text style={styles.appName}>BONGO STREAM</Text>
        <Text style={styles.tagline}>Muziki wa Tanzania</Text>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]} onPress={() => setMode('login')}>
            <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>Ingia</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]} onPress={() => setMode('signup')}>
            <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>Jisajili</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Up fields */}
        {mode === 'signup' && (
          <>
            <Field label="Jina Kamili" value={displayName} onChange={setDisplayName} placeholder="Jina lako..." icon="person-outline" />
            <Field label="Jina la Mtumiaji" value={username} onChange={t => setUsername(t.toLowerCase())} placeholder="@username" icon="at-outline" />
          </>
        )}

        <Field label={mode === 'login' ? "Barua Pepe au Jina la Mtumiaji" : "Barua Pepe"} value={email} onChange={setEmail} placeholder={mode === 'login' ? "mfano@gmail.com au @username" : "mfano@gmail.com"} icon={mode === 'login' ? "person-outline" : "mail-outline"} keyboardType={mode === 'login' ? "default" : "email-address"} autoCapitalize="none" />

        {/* Password */}
        <Text style={styles.fieldLabel}>Nywila</Text>
        <View style={styles.pwRow}>
          <Ionicons name="lock-closed-outline" size={18} color={COLORS.gold} />
          <TextInput
            style={styles.pwInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Nywila yako..."
            placeholderTextColor={COLORS.textTertiary}
            secureTextEntry={!pwVisible}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setPwVisible(!pwVisible)}>
            <Ionicons name={pwVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Verify Password (Signup Only) */}
        {mode === 'signup' && (
          <>
            <Text style={styles.fieldLabel}>Thibitisha Nywila</Text>
            <View style={styles.pwRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.gold} />
              <TextInput
                style={styles.pwInput}
                value={verifyPassword}
                onChangeText={setVerifyPassword}
                placeholder="Thibitisha nywila yako..."
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry={!vpwVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setVpwVisible(!vpwVisible)}>
                <Ionicons name={vpwVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Artist toggle */}
        {mode === 'signup' && (
          <>
            <TouchableOpacity
              style={[styles.artistToggle, isArtist && styles.artistToggleActive]}
              onPress={() => setIsArtist(!isArtist)}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="mic" size={18} color={isArtist ? COLORS.gold : COLORS.textPrimary} />
                  <Text style={[styles.artistToggleTitle, isArtist && { color: COLORS.gold }]}>
                    Mimi ni Msanii
                  </Text>
                </View>
                <Text style={styles.artistToggleSub}>Wezesha kupakia nyimbo</Text>
              </View>
              <View style={[styles.checkbox, isArtist && styles.checkboxActive]}>
                {isArtist && <Ionicons name="checkmark" size={14} color={COLORS.black} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.termsRow} onPress={() => setAcceptedTerms(!acceptedTerms)}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color={COLORS.black} />}
              </View>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                <Text style={styles.termsText}>I agree to the </Text>
                <TouchableOpacity onPress={() => router.push('/terms')}>
                  <Text style={styles.termsLink}>Terms & Conditions</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator color={COLORS.black} size="small" />
            : <Text style={styles.submitText}>{mode === 'login' ? 'Ingia' : 'Jisajili'}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, icon, keyboardType }: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Ionicons name={icon} size={18} color={COLORS.gold} />
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  content: { padding: 24, paddingTop: 72, gap: 12 },
  logoWrap: { alignItems: 'center', marginBottom: 4 },
  appName: { color: COLORS.gold, fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 3 },
  tagline: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  modeToggle: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 4, marginVertical: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: COLORS.gold + '30' },
  modeBtnText: { color: COLORS.textTertiary, fontWeight: '700' },
  modeBtnTextActive: { color: COLORS.gold },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  fieldInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  pwRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  pwInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  artistToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.divider, gap: 12, marginTop: 4 },
  artistToggleActive: { borderColor: COLORS.gold, backgroundColor: COLORS.gold + '15' },
  artistToggleTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  artistToggleSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.divider, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10, paddingHorizontal: 4 },
  termsText: { color: COLORS.textSecondary, fontSize: 13 },
  termsLink: { color: COLORS.gold, fontSize: 13, textDecorationLine: 'underline' },
  submitBtn: { backgroundColor: COLORS.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  submitText: { color: COLORS.black, fontWeight: '900', fontSize: 16 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: COLORS.textTertiary, fontSize: 13 },
});
