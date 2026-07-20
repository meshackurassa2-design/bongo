import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ScrollView } from 'react-native';
import { useThemeStore } from '../../store/themeStore';
import { useRoadTripStore } from '../../store/roadTripStore';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HostScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { sessionId, startRoadTrip, participants, leaveRoadTrip } = useRoadTripStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startRoadTrip();
    setLoading(false);
    return () => {
      // Don't leave immediately on unmount if they just went to queue
    };
  }, []);

  const handleShare = async () => {
    if (!sessionId) return;
    try {
      await Share.share({
        message: `Join my Bongo Stream Road Trip! Code: ${sessionId}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const endSession = () => {
    leaveRoadTrip();
    router.replace('/');
  };

  if (loading || !sessionId) {
    return <View style={styles.container}><Text style={styles.text}>Starting...</Text></View>;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: COLORS.black }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Road Trip Mode</Text>
      <Text style={styles.subtitle}>Ask friends to scan this QR code or enter the code to join.</Text>

      <View style={styles.qrContainer}>
        <QRCode
          value={sessionId}
          size={220}
          color={COLORS.black}
          backgroundColor="white"
        />
        <View style={styles.codeWrap}>
          <Text style={styles.codeText}>{sessionId}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Ionicons name="share-outline" size={20} color={COLORS.black} />
        <Text style={styles.shareText}>Share Code</Text>
      </TouchableOpacity>

      <View style={styles.participantsBox}>
        <Text style={styles.participantsTitle}>Connected Friends ({participants.length})</Text>
        {participants.length === 0 ? (
          <Text style={styles.participantsEmpty}>Waiting for friends to join...</Text>
        ) : (
          participants.map((p, i) => (
            <View key={i} style={styles.participantRow}>
              <Ionicons name="person-circle" size={24} color={COLORS.gold} />
              <Text style={styles.participantName}>{p.name}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.queueBtn} onPress={() => router.push('/roadtrip/shared-queue')}>
          <Ionicons name="list" size={24} color={COLORS.gold} />
          <Text style={styles.queueBtnText}>Open Shared Queue</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.endBtn} onPress={endSession}>
          <Text style={styles.endBtnText}>End Road Trip</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.black, alignItems: 'center', padding: 24, paddingBottom: 60 },
  text: { color: COLORS.textPrimary },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 40 },
  qrContainer: { backgroundColor: 'white', padding: 16, borderRadius: 16, alignItems: 'center' },
  codeWrap: { marginTop: 16, backgroundColor: COLORS.cardAlt, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8 },
  codeText: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24, gap: 8 },
  shareText: { color: COLORS.black, fontWeight: '800' },
  participantsBox: { width: '100%', marginTop: 40, backgroundColor: COLORS.card, padding: 16, borderRadius: 16 },
  participantsTitle: { color: COLORS.textPrimary, fontWeight: '700', marginBottom: 12 },
  participantsEmpty: { color: COLORS.textSecondary, fontStyle: 'italic' },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  participantName: { color: COLORS.textPrimary, fontWeight: '600' },
  bottomActions: { width: '100%', marginTop: 'auto', gap: 12 },
  queueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: COLORS.gold },
  queueBtnText: { color: COLORS.gold, fontWeight: '800' },
  endBtn: { alignItems: 'center', padding: 16 },
  endBtnText: { color: COLORS.error, fontWeight: '700' },
});
