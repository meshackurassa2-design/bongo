import { create } from 'zustand';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { supabase } from '../lib/supabase';

type PlayerStore = {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  hasCountedPlay: boolean;
  positionMs: number;
  durationMs: number;
  isShuffled: boolean;
  repeatOne: boolean;
  playbackRate: number;
  sound: Audio.Sound | null;
  // Actions
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  cleanup: () => Promise<void>;
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  hasCountedPlay: false,
  positionMs: 0,
  durationMs: 0,
  isShuffled: false,
  repeatOne: false,
  playbackRate: 1.0,
  sound: null,

  playTrack: async (track, queue = [track]) => {
    const { sound: prevSound } = get();
    
    // Update UI instantly to new track
    set({ currentTrack: track, queue, hasCountedPlay: false, isPlaying: true });

    if (prevSound) {
      try {
        await prevSound.unloadAsync();
      } catch (e) {}
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const localUri = useOfflineStore.getState().getLocalUri(track.id);
    const isExtensionless = track.audio_url ? !track.audio_url.match(/\.(mp3|m4a|wav|ogg|aac|flac)(\?|$)/i) : false;
    const audioSource = localUri 
      ? { uri: localUri }
      : { 
          uri: track.audio_url,
          ...(isExtensionless ? { overrideFileExtensionAndroid: 'mp3', headers: { 'Accept': 'audio/mpeg, audio/*, */*' } } : {})
        };

    try {
      const { sound, status } = await Audio.Sound.createAsync(
        audioSource,
        { shouldPlay: true, progressUpdateIntervalMillis: 500, rate: get().playbackRate, shouldCorrectPitch: false },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            const currentTrack = get().currentTrack as any;
            const trackSeconds = currentTrack?.duration_sec || currentTrack?.duration || 0;
            const fallbackDuration = trackSeconds * 1000;
            
            set({
              positionMs: status.positionMillis,
              durationMs: status.durationMillis || fallbackDuration,
              isPlaying: status.isPlaying,
            });

            // 30-second play counter for monetization
            const { hasCountedPlay } = get();
            if (currentTrack && !hasCountedPlay && status.positionMillis >= 30000) {
              set({ hasCountedPlay: true });
              supabase.rpc('increment_play_count', { track_id: currentTrack.id }).then(({ error }) => {
                if (error) console.error("Failed to increment play count:", error);
              });
            }

            // Auto-advance to next track
            if (status.didJustFinish) {
              if (get().repeatOne) {
                sound.replayAsync();
              } else {
                get().skipNext();
              }
            }
          }
        }
      );

      // If user tapped a different track while this one was loading, discard this sound
      if (get().currentTrack?.id !== track.id) {
        sound.unloadAsync();
        return;
      }

      set({
        sound,
        isPlaying: true,
      });
    } catch (e) {
      console.error("Failed to load sound", e);
    }
  },

  togglePlayPause: async () => {
    const { sound, isPlaying } = get();
    if (!sound) return;
    
    set({ isPlaying: !isPlaying });
    
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  },

  skipNext: async () => {
    const { queue, currentTrack, isShuffled, playTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    let nextIdx: number;
    if (isShuffled) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = (currentIdx + 1) % queue.length;
    }
    await playTrack(queue[nextIdx], queue);
  },

  skipPrev: async () => {
    const { queue, currentTrack, positionMs, playTrack } = get();
    const { sound } = get();
    if (!currentTrack) return;
    // If > 3s in, restart current track
    if (positionMs > 3000 && sound) {
      await sound.setPositionAsync(0);
      return;
    }
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : queue.length - 1;
    await playTrack(queue[prevIdx], queue);
  },

  seekTo: async (ms: number) => {
    const { sound } = get();
    if (!sound) return;
    try {
      await sound.setPositionAsync(ms);
    } catch(e) {}
  },

  setPlaybackRate: async (rate: number) => {
    set({ playbackRate: rate });
    const { sound } = get();
    if (sound) {
      try {
        await sound.setRateAsync(rate, false);
      } catch (e) {
        console.log("Failed to set rate:", e);
      }
    }
  },

  toggleShuffle: () => set(s => ({ isShuffled: !s.isShuffled })),
  toggleRepeat: () => set(s => ({ repeatOne: !s.repeatOne })),

  cleanup: async () => {
    const { sound } = get();
    if (sound) await sound.unloadAsync();
    set({ sound: null, currentTrack: null, isPlaying: false });
  },
}));
