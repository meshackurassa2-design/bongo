import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
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
  } = usePlayerStore();

  const { downloadTrack, isDownloaded, isDownloading, downloadProgress } = useOfflineStore();

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
        <View style={styles.iconBtn} />
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
          onPress={() => {
            const nextRate = playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : playbackRate === 2.0 ? 0.5 : 1.0;
            setPlaybackRate(nextRate);
          }}
        >
          <Ionicons name="color-wand" size={16} color={playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary} />
          <Text style={{ 
            color: playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary, 
            fontWeight: '800', 
            fontSize: 12,
            letterSpacing: 1
          }}>
            VOICE TUNER {playbackRate.toFixed(1)}x
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 30 },
  iconBtn: { padding: 8, width: 48, alignItems: 'center' },
  headerTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  coverWrap: { alignItems: 'center', marginBottom: 40 },
  cover: { width: width - 64, height: width - 64, borderRadius: 20, backgroundColor: COLORS.cardAlt, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  coverFallback: { justifyContent: 'center', alignItems: 'center' },
  closeBtn: { marginTop: 50, marginLeft: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 30 },
  infoWrap: { flex: 1, paddingRight: 16 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  artist: { color: COLORS.gold, fontSize: 18, fontWeight: '500' },
  downloadBtn: { padding: 8 },
  progressWrap: { paddingHorizontal: 24, marginBottom: 30 },
  slider: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: -10 },
  timeText: { color: COLORS.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
  controlsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  ctrlBtn: { padding: 10 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
});
