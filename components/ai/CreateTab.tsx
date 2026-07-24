import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { generateMusic, uploadAndCoverAudio } from '../../lib/sunoApi';
import { useAIStore } from '../../store/aiStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import AudioRecorder from './AudioRecorder';


interface CreateTabProps {
  onGenerateSuccess: () => void;
  openLyricsModal: (onComplete: (lyrics: string) => void) => void;
}

export default function CreateTab({ onGenerateSuccess, openLyricsModal }: CreateTabProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [lyrics, setLyrics] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vocalGender, setVocalGender] = useState<'Male' | 'Female' | 'Any'>('Any');
  const [weirdness, setWeirdness] = useState<number>(50);
  const [styleInfluence, setStyleInfluence] = useState<number>(50);
  
  const [isGenerating, setIsGenerating] = useState(false);

  const { addTask, personas } = useAIStore();
  const { session, profile } = useAuthStore();
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!title || !style || !lyrics) {
      Alert.alert("Missing Fields", "Please fill out title, style, and lyrics.");
      return;
    }
    
    const requiredCredits = 1;

    if ((profile?.credits || 0) < requiredCredits) {
      Alert.alert(
        "Not Enough Credits", 
        `You need ${requiredCredits} credit${requiredCredits > 1 ? 's' : ''} to generate this song.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Buy Credits", onPress: () => router.push('/buy-credits') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('deduct_credits', { user_id: profile?.id, amount: requiredCredits });
      if (error || data === false) {
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({ credits: (profile?.credits || 0) - requiredCredits })
          .eq('id', profile?.id);
          
        if (fallbackError) {
          throw new Error(`Failed to deduct credits: ${fallbackError.message}`);
        }
      }
      
      const taskId = await generateMusic(lyrics, style, title, null, vocalGender, weirdness, styleInfluence);
      
      addTask(taskId, title);
      
      setTitle('');
      setStyle('');
      setLyrics('');
      
      if (session?.user.id) useAuthStore.getState().fetchProfile(session.user.id);
      
      onGenerateSuccess();
    } catch (e: any) {
      Alert.alert("Error", "Failed to generate song. Your credit has been refunded. (" + e.message + ")");
      // Refund credits since generation failed
      try {
        const { error: refundError } = await supabase.rpc('deduct_credits', { user_id: profile?.id, amount: -requiredCredits });
        if (refundError) {
          // Fallback if rpc fails
          await supabase
            .from('profiles')
            .update({ credits: (profile?.credits || 0) + requiredCredits })
            .eq('id', profile?.id);
        }
        if (session?.user.id) useAuthStore.getState().fetchProfile(session.user.id);
      } catch (err) {
        console.error("Failed to refund credits", err);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {(profile?.credits || 0) <= 2 && (
        <TouchableOpacity style={styles.lowCreditBanner} onPress={() => router.push('/buy-credits')}>
          <LinearGradient colors={['#FF3B30', '#FF9500']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <Ionicons name="alert-circle" size={24} color={COLORS.black} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.lowCreditTitle}>Running Low on Credits!</Text>
            <Text style={styles.lowCreditSub}>You only have {profile?.credits || 0} credits left. Tap here to refill.</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Song Title</Text>
      <TextInput style={styles.input} placeholder="e.g. Midnight Memories" placeholderTextColor={COLORS.textTertiary} value={title} onChangeText={setTitle} />
      
      <View style={styles.inputRow}>
        <Ionicons name="musical-notes-outline" size={20} color={COLORS.gold} />
        <TextInput style={styles.input} placeholder="e.g. Acoustic pop, upbeat" placeholderTextColor={COLORS.textTertiary} value={style} onChangeText={setStyle} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
        <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>Lyrics</Text>
        <TouchableOpacity style={styles.autoWriteBtn} onPress={() => openLyricsModal(setLyrics)}>
          <LinearGradient colors={[COLORS.gold, '#FFD700']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <Ionicons name="sparkles" size={14} color={COLORS.black} />
          <Text style={styles.autoWriteText}>Auto-Write AI (Free)</Text>
        </TouchableOpacity>
      </View>
      
      <TextInput style={[styles.input, styles.textArea]} placeholder="Write your verses and chorus here..." placeholderTextColor={COLORS.textTertiary} value={lyrics} onChangeText={setLyrics} multiline textAlignVertical="top" />

      <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)} activeOpacity={0.7}>
        <Text style={styles.advancedToggleText}>Advanced Options</Text>
        <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={COLORS.gold} />
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedContainer}>
          {personas.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.label, { marginTop: 0 }]}>Use Custom Voice Persona</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <TouchableOpacity 
                  style={[styles.personaPill, !selectedPersona && styles.personaPillActive]}
                  onPress={() => setSelectedPersona(null)}
                >
                  <Text style={[styles.personaPillText, !selectedPersona && styles.personaPillTextActive]}>None</Text>
                </TouchableOpacity>
                {personas.map(p => (
                  <TouchableOpacity 
                    key={p.id}
                    style={[styles.personaPill, selectedPersona === p.id && styles.personaPillActive]}
                    onPress={() => setSelectedPersona(p.id)}
                  >
                    <Ionicons name="mic" size={14} color={selectedPersona === p.id ? COLORS.black : COLORS.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.personaPillText, selectedPersona === p.id && styles.personaPillTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 0 }]}>Vocal Gender</Text>
          <View style={styles.genderRow}>
            {['Male', 'Female', 'Any'].map(g => (
              <TouchableOpacity 
                key={g} 
                style={[styles.genderBtn, vocalGender === g && styles.genderBtnActive]}
                onPress={() => setVocalGender(g as any)}
              >
                <Text style={[styles.genderText, vocalGender === g && styles.genderTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 24 }]}>Weirdness: {weirdness}%</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={weirdness}
            onValueChange={setWeirdness}
            minimumTrackTintColor={COLORS.gold}
            maximumTrackTintColor={COLORS.divider}
            thumbTintColor={COLORS.gold}
          />
          <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginBottom: 8 }}>Controls the variance and creative liberty of the generation.</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Style Influence: {styleInfluence}%</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={styleInfluence}
            onValueChange={setStyleInfluence}
            minimumTrackTintColor={COLORS.gold}
            maximumTrackTintColor={COLORS.divider}
            thumbTintColor={COLORS.gold}
          />
          <Text style={{ color: COLORS.textTertiary, fontSize: 12 }}>How strictly the AI follows the genre prompts.</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]} onPress={handleGenerate} disabled={isGenerating}>
        <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
        {isGenerating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={COLORS.black} />
            <Text style={styles.generateBtnText}>Composing...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="musical-notes" size={20} color={COLORS.black} />
            <Text style={styles.generateBtnText}>Generate with AI (1 Credit)</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.buyCreditsInlineBtn} onPress={() => router.push('/buy-credits')}>
        <Ionicons name="diamond" size={16} color={COLORS.gold} />
        <Text style={styles.buyCreditsInlineText}>Get More Credits</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  autoWriteBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 6, overflow: 'hidden' },
  autoWriteText: { color: COLORS.black, fontSize: 12, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { flex: 1, color: COLORS.textPrimary, paddingVertical: 16, borderRadius: 16, fontSize: 15 },
  textArea: { height: 180, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginTop: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  advancedToggleText: { color: COLORS.gold, fontSize: 15, fontWeight: '700' },
  advancedContainer: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  
  lowCreditBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  lowCreditTitle: { color: COLORS.black, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  lowCreditSub: { color: COLORS.black, fontSize: 13, fontWeight: '600' },
  
  uploadBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  uploadBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: 14 },
  
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  personaCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, width: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 16, marginTop: 8 },
  personaCardActive: { borderColor: COLORS.gold, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
  personaName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  personaDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  
  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  genderBtnActive: { backgroundColor: 'rgba(212, 175, 55, 0.2)', borderColor: COLORS.gold },
  genderText: { color: COLORS.textSecondary, fontWeight: '600' },
  genderTextActive: { color: COLORS.gold },
  
  generateBtn: { paddingVertical: 18, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 40, overflow: 'hidden' },
  generateBtnText: { color: COLORS.black, fontSize: 18, fontWeight: '800' },
  
  personaPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  personaPillActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  personaPillText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  personaPillTextActive: { color: COLORS.black, fontWeight: '800' },

  buyCreditsInlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 16, borderRadius: 30, marginBottom: 40, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  buyCreditsInlineText: { color: COLORS.gold, fontSize: 15, fontWeight: '700' },
});
