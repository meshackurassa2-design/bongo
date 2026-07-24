import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';


import CreateTab from '../../components/ai/CreateTab';
import UploadCoverTab from '../../components/ai/UploadCoverTab';
import WorkspaceTab from '../../components/ai/WorkspaceTab';
import PersonasTab from '../../components/ai/PersonasTab';
import SoundsTab from '../../components/ai/SoundsTab';
import AILyricsModal from '../../components/ai/AILyricsModal';
import ExtractPersonaModal from '../../components/ai/ExtractPersonaModal';

type TabType = 'Create' | 'Cover' | 'Sounds' | 'Workspace' | 'Personas';
const TABS: TabType[] = ['Create', 'Cover', 'Sounds', 'Workspace', 'Personas'];

export default function AIStudioScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { profile } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<TabType>('Create');
  
  // Modals state
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [extractAudioId, setExtractAudioId] = useState<string | null>(null);
  
  // For passing back generated lyrics to CreateTab
  const [lyricsCallback, setLyricsCallback] = useState<((lyrics: string) => void) | null>(null);

  const openLyricsModal = (onComplete: (lyrics: string) => void) => {
    setLyricsCallback(() => onComplete);
    setShowLyricsModal(true);
  };

  const handleLyricsComplete = (lyrics: string) => {
    if (lyricsCallback) {
      lyricsCallback(lyrics);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Studio</Text>
        <TouchableOpacity 
          style={[styles.creditBadge, (profile?.credits || 0) <= 2 && { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderColor: COLORS.error, borderWidth: 1 }]} 
          onPress={() => router.push('/buy-credits')}
        >
          <Ionicons name="diamond" size={14} color={(profile?.credits || 0) <= 2 ? COLORS.error : COLORS.gold} />
          <Text style={[styles.creditText, (profile?.credits || 0) <= 2 && { color: COLORS.error }]}>
            {profile?.credits || 0}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Premium Tab Bar */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tab, isActive && styles.activeTab]} 
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                {isActive && (
                  <LinearGradient 
                    colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']} 
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                  />
                )}
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeTab === 'Create' && (
          <CreateTab 
            onGenerateSuccess={() => setActiveTab('Workspace')} 
            openLyricsModal={openLyricsModal} 
          />
        )}
        {activeTab === 'Cover' && (
          <UploadCoverTab 
            onGenerateSuccess={() => setActiveTab('Workspace')} 
            openLyricsModal={openLyricsModal}
          />
        )}
        {activeTab === 'Sounds' && (
          <SoundsTab 
            onGenerateSuccess={() => setActiveTab('Workspace')} 
          />
        )}
        {activeTab === 'Workspace' && (
          <WorkspaceTab 
            openPersonaModal={(id) => setExtractAudioId(id)} 
          />
        )}
        {activeTab === 'Personas' && (
          <PersonasTab />
        )}
      </View>
      
      <AILyricsModal 
        visible={showLyricsModal} 
        onClose={() => setShowLyricsModal(false)} 
        onComplete={handleLyricsComplete} 
      />

      <ExtractPersonaModal 
        audioId={extractAudioId} 
        onClose={() => setExtractAudioId(null)} 
      />
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  creditBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  creditText: { color: COLORS.gold, fontSize: 14, fontWeight: '700' },
  
  tabContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 8 },
  tabScroll: { paddingHorizontal: 16, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  activeTab: { borderColor: 'rgba(212, 175, 55, 0.3)' },
  tabText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  activeTabText: { color: COLORS.gold, fontWeight: '800' },
  
  content: { flex: 1 },
});
