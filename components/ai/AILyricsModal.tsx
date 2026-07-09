import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';


interface AILyricsModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (lyrics: string) => void;
}

export default function AILyricsModal({ visible, onClose, onComplete }: AILyricsModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateLyrics = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert("Missing Prompt", "Please enter what the song should be about.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-lyrics', {
        body: { prompt: aiPrompt }
      });
      
      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error(data?.error || "Failed to generate lyrics");
      
      onComplete(data.lyrics);
      onClose();
      setAiPrompt('');
    } catch (e: any) {
      Alert.alert("AI Error", e.message || "Failed to connect to AI Writer");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BlurView intensity={70} tint="dark" style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={24} color={COLORS.gold} />
                <Text style={styles.title}>AI Lyric Writer</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={isGenerating}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.desc}>
              Describe what your song is about, the mood, and the language. AI will write full structured lyrics for free.
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="e.g. A bongo flava song about hustling in Kariakoo, sung in Swahili."
              placeholderTextColor={COLORS.textTertiary}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              multiline
              textAlignVertical="top"
              editable={!isGenerating}
            />
            
            <TouchableOpacity 
              style={[styles.generateBtn, isGenerating && { opacity: 0.5 }]} 
              onPress={handleGenerateLyrics} 
              disabled={isGenerating}
            >
              <LinearGradient colors={[COLORS.gold, '#F9A826']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
              {isGenerating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={COLORS.black} />
                  <Text style={styles.generateBtnText}>Writing Lyrics...</Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>Generate Lyrics</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { width: '100%', backgroundColor: 'rgba(28,28,30,0.85)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  desc: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: { height: 120, backgroundColor: 'rgba(0,0,0,0.3)', color: COLORS.textPrimary, padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  generateBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 24, overflow: 'hidden' },
  generateBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
});
