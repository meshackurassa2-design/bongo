import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { usePlayerStore } from '../store/playerStore';
import { useOfflineStore } from '../store/offlineStore';
import { COLORS } from '../constants';

const { width } = Dimensions.get('window');

export default function PlayerScreen() {
  const router = useRouter();
  const {
    currentTrack,
    isPlaying,
    positionMs,
    durationMs,
    isShuffled,
    repeatOne,
    togglePlayPause,
    skipNext,
    skipPrev,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    playbackRate,
    setPlaybackRate,
    sleepTimerMs,
    setSleepTimer,
    clearSleepTimer,
  } = usePlayerStore();

  const { downloadTrack, isDownloaded, isDownloading, downloadProgress } = useOfflineStore();

  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showFxModal, setShowFxModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!currentTrack) return;
    setIsSharing(true);
    try {
      const localUri = FileSystem.cacheDirectory + `${currentTrack.id}.mp3`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      
      if (!fileInfo.exists) {
        await FileSystem.downloadAsync(currentTrack.audio_url, localUri);
      }
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          dialogTitle: `Share ${currentTrack.title}`,
          mimeType: 'audio/mpeg',
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (e: any) {
      Alert.alert("Share Error", e.message);
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (!sleepTimerMs) {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.max(0, sleepTimerMs - Date.now());
      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMs]);


  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <LinearGradient colors={['#1a1a1a', COLORS.black]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inacheza Sasa</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSleepTimer(true)}>
          <Ionicons name={sleepTimerMs ? "alarm" : "alarm-outline"} size={26} color={sleepTimerMs ? COLORS.gold : COLORS.textPrimary} />
          {timeLeft && <Text style={{ color: COLORS.gold, fontSize: 10, fontWeight: '700', marginTop: 2, width: 56, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{timeLeft}</Text>}
        </TouchableOpacity>
      </View>

      {/* Cover Art */}
      <View style={styles.coverWrap}>
        {currentTrack.cover_url ? (
          <Image source={{ uri: currentTrack.cover_url }} style={styles.cover} transition={300} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Ionicons name="musical-notes" size={80} color={COLORS.textTertiary} />
          </View>
        )}
      </View>

      {/* Info & Actions */}
      <View style={styles.infoRow}>
        <View style={styles.infoWrap}>
          <Text style={styles.title} numberOfLines={2}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist_name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleShare}>
            {isSharing ? <ActivityIndicator size="small" color={COLORS.textPrimary} /> : <Ionicons name="share-social-outline" size={26} color={COLORS.textSecondary} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.downloadBtn} 
            onPress={() => !isDownloaded(currentTrack.id) && !isDownloading[currentTrack.id] && downloadTrack(currentTrack)}
          >
            {isDownloading[currentTrack.id] ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.gold} />
                <Text style={{ color: COLORS.gold, fontSize: 10, marginTop: 4, fontWeight: '700' }}>
                  {Math.round((downloadProgress[currentTrack.id] || 0) * 100)}%
                </Text>
              </View>
            ) : (
              <Ionicons 
                name={isDownloaded(currentTrack.id) ? "checkmark-circle" : "cloud-download-outline"} 
                size={28} 
                color={isDownloaded(currentTrack.id) ? COLORS.gold : COLORS.textSecondary} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
        <TouchableOpacity 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: 6, 
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 20, 
            backgroundColor: playbackRate !== 1.0 ? COLORS.gold : COLORS.cardAlt 
          }}
          onPress={() => setShowFxModal(true)}
        >
          <Ionicons name="color-wand" size={16} color={playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary} />
          <Text style={{ 
            color: playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary, 
            fontWeight: '800', 
            fontSize: 12,
            letterSpacing: 1
          }}>
            AUDIO EFFECTS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Seek Bar */}
      <View style={styles.progressWrap}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(durationMs || 1, positionMs + 1)}
          value={positionMs}
          onSlidingComplete={seekTo}
          minimumTrackTintColor={COLORS.gold}
          maximumTrackTintColor={COLORS.divider}
          thumbTintColor={COLORS.gold}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsWrap}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={26} color={isShuffled ? COLORS.gold : COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={skipPrev}>
          <Ionicons name="play-skip-back" size={36} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={COLORS.black} style={{ marginLeft: isPlaying ? 0 : 4 }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={36} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleRepeat}>
          <Ionicons name="repeat" size={26} color={repeatOne ? COLORS.gold : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sleep Timer Modal */}
      <Modal visible={showSleepTimer} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Sleep Timer</Text>
            <Text style={styles.modalSub}>Music will pause automatically</Text>
            
            <View style={{ gap: 12, marginTop: 20 }}>
              {[15, 30, 45, 60].map(mins => (
                <TouchableOpacity 
                  key={mins} 
                  style={styles.sleepOptionBtn}
                  onPress={() => { setSleepTimer(mins); setShowSleepTimer(false); }}
                >
                  <Text style={styles.sleepOptionText}>{mins} Minutes</Text>
                  <Ionicons name="time-outline" size={20} color={COLORS.gold} />
                </TouchableOpacity>
              ))}
              
              {sleepTimerMs && (
                <TouchableOpacity 
                  style={[styles.sleepOptionBtn, { backgroundColor: 'rgba(255,50,50,0.1)', borderColor: 'rgba(255,50,50,0.3)' }]}
                  onPress={() => { clearSleepTimer(); setShowSleepTimer(false); }}
                >
                  <Text style={[styles.sleepOptionText, { color: '#ff5555' }]}>Turn Off Timer</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowSleepTimer(false)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Audio Effects Modal */}
      <Modal visible={showFxModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Audio Effects</Text>
            <Text style={styles.modalSub}>Adjust playback speed and pitch</Text>
            
            <View style={{ marginTop: 30, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>Speed / Pitch</Text>
                <Text style={{ color: COLORS.gold, fontWeight: '700' }}>{playbackRate.toFixed(2)}x</Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0.5}
                maximumValue={2.0}
                step={0.1}
                value={playbackRate}
                onValueChange={setPlaybackRate}
                minimumTrackTintColor={COLORS.gold}
                maximumTrackTintColor={COLORS.divider}
                thumbTintColor={COLORS.gold}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -10 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Slow & Low</Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Fast & High</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.sleepOptionBtn, { justifyContent: 'center', marginBottom: 16 }]}
              onPress={() => setPlaybackRate(1.0)}
            >
              <Text style={styles.sleepOptionText}>Reset to Normal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowFxModal(false)}>
              <Text style={styles.closeModalText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  iconBtn: { padding: 8, width: 56, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  coverWrap: { alignItems: 'center', marginBottom: 24 },
  cover: { width: width - 80, height: width - 80, borderRadius: 20, backgroundColor: COLORS.cardAlt, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  coverFallback: { justifyContent: 'center', alignItems: 'center' },
  closeBtn: { marginTop: 50, marginLeft: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 16 },
  infoWrap: { flex: 1, paddingRight: 16 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  artist: { color: COLORS.gold, fontSize: 18, fontWeight: '500' },
  downloadBtn: { padding: 8 },
  progressWrap: { paddingHorizontal: 24, marginBottom: 20 },
  slider: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: -10 },
  timeText: { color: COLORS.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
  controlsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  ctrlBtn: { padding: 10 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 50 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalSub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  sleepOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider },
  sleepOptionText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  closeModalBtn: { marginTop: 24, padding: 16, borderRadius: 16, alignItems: 'center' },
  closeModalText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700' },
});
