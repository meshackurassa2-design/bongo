import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../store/playerStore';
import { useThemeStore } from '../store/themeStore';
import { useProgress, usePlaybackState, State } from 'react-native-track-player';

import { useRouter } from 'expo-router';

export default function MiniPlayer() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { currentTrack, togglePlayPause, skipNext, skipPrev, markPlayCounted, hasCountedPlay } = usePlayerStore();
  const { position, duration } = useProgress();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  useEffect(() => {
    if (position >= 30 && !hasCountedPlay && currentTrack) {
      markPlayCounted();
    }
  }, [position, hasCountedPlay, currentTrack]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.infoWrap} activeOpacity={0.9} onPress={() => router.push('/player')}>
          {/* Cover */}
          <View style={styles.coverWrap}>
            {currentTrack.cover_url
              ? <Image source={{ uri: currentTrack.cover_url }} style={styles.cover} transition={200} cachePolicy="memory-disk" />
              : <View style={[styles.cover, styles.coverFallback]}>
                  <Ionicons name="musical-note" size={18} color={COLORS.textTertiary} />
                </View>
            }
            {isPlaying && <View style={styles.glowDot} />}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist_name}</Text>
          </View>
        </TouchableOpacity>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={skipPrev} style={styles.ctrlBtn}>
            <Ionicons name="play-skip-back" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={COLORS.black} style={{ marginLeft: isPlaying ? 0 : 2 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={skipNext} style={styles.ctrlBtn}>
            <Ionicons name="play-skip-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.divider },
  progressTrack: { height: 2, backgroundColor: COLORS.divider },
  progressFill: { height: 2, backgroundColor: COLORS.gold },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  infoWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  coverWrap: { position: 'relative' },
  cover: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.cardAlt },
  coverFallback: { justifyContent: 'center', alignItems: 'center' },
  glowDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  info: { flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  artist: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctrlBtn: { padding: 6 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
});
