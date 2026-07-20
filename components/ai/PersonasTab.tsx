import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAIStore } from '../../store/aiStore';
import { useThemeStore } from '../../store/themeStore';

import CustomVoiceWizard from './CustomVoiceWizard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 16) / 2; // 2 columns, padding 16, gap 16

export default function PersonasTab() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { personas, removePersona } = useAIStore();
  const [showInfo, setShowInfo] = useState(true);
  const [voiceWizardVisible, setVoiceWizardVisible] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        {/* Header Action Card */}
        <TouchableOpacity style={styles.actionBanner} onPress={() => setVoiceWizardVisible(true)}>
          <LinearGradient colors={['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.05)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.actionBannerContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="mic" size={24} color={COLORS.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.actionBannerTitle}>Clone a Custom Voice</Text>
              <Text style={styles.actionBannerDesc}>Record or upload audio to train a personalized AI voice model.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.sectionTitle}>Your Personas</Text>
          <Text style={styles.sectionSubtitle}>{personas.length} Models</Text>
        </View>

        {showInfo && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={24} color={COLORS.gold} />
            <Text style={styles.infoText}>
              Personas are unique musical identities extracted from your tracks. Use them to cover new songs in the exact same style!
            </Text>
            <TouchableOpacity onPress={() => setShowInfo(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color={COLORS.gold} />
            </TouchableOpacity>
          </View>
        )}

        {personas.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={48} color={COLORS.textTertiary} />
            </View>
            <Text style={styles.emptyText}>No personas created yet.</Text>
            <Text style={styles.emptySub}>Go to your Workspace and extract a persona from an AI generated track.</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {personas.map(p => (
              <View key={p.id} style={styles.personaCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removePersona(p.id)} style={styles.trashBtn}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.personaName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.personaDesc} numberOfLines={3}>{p.description}</Text>
                
                <View style={styles.cardFooter}>
                  <Ionicons name="musical-notes" size={12} color={COLORS.gold} />
                  <Text style={styles.cardFooterText}>Ready to use</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <CustomVoiceWizard 
        visible={voiceWizardVisible}
        onClose={() => setVoiceWizardVisible(false)}
        onSuccess={() => {}}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  
  actionBanner: { borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  actionBannerContent: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(212, 175, 55, 0.2)', alignItems: 'center', justifyContent: 'center' },
  actionBannerTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  actionBannerDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  sectionSubtitle: { color: COLORS.textTertiary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  
  infoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212, 175, 55, 0.08)', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  infoText: { color: COLORS.gold, fontSize: 13, lineHeight: 20, flex: 1, marginLeft: 12, fontWeight: '500' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 20 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  personaCard: { width: CARD_WIDTH, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212, 175, 55, 0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.gold, fontSize: 18, fontWeight: '800' },
  trashBtn: { padding: 6, backgroundColor: 'rgba(255, 59, 48, 0.1)', borderRadius: 8 },
  
  personaName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  personaDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
  
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 6 },
  cardFooterText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
});
