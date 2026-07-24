import { create } from 'zustand';
import TrackPlayer, { 
  State as TPState, 
  Event, 
  useProgress as useTPProgress,
  usePlaybackState as useTPPlaybackState,
  Capability,
  AppKilledPlaybackBehavior,
  Track as TPTrack
} from 'react-native-track-player';
import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import React from 'react';

// Re-export TrackPlayer hooks so components don't have to change
export const useProgress = useTPProgress;
export const usePlaybackState = useTPPlaybackState;
export const State = TPState;

export type PlayerMode = 'local' | 'listener' | 'host';

type PlayerStore = {
  currentTrack: Track | null;
  queue: Track[];
  isShuffled: boolean;
  repeatOne: boolean;
  playbackRate: number;
  sleepTimerMs: number | null;
  sleepTimerInterval: any | null;
  hasCountedPlay: boolean;
  isPlayerReady: boolean;
  mode: PlayerMode;
  liveStationId: string | null;

  initPlayer: () => Promise<void>;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  markPlayCounted: () => void;
  cleanup: () => Promise<void>;
  setMode: (mode: PlayerMode, stationId?: string) => void;
  setVolume: (volume: number) => Promise<void>;
  addTrackToQueue: (track: Track) => void;
  reorderQueue: (from: number, to: number) => void;
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  isShuffled: false,
  repeatOne: false,
  playbackRate: 1.0,
  sleepTimerMs: null,
  sleepTimerInterval: null,
  hasCountedPlay: false,
  isPlayerReady: false,
  mode: 'local',
  liveStationId: null,

  initPlayer: async () => {
    if (get().isPlayerReady) return;
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
      });
      set({ isPlayerReady: true });
    } catch (e) {
      console.log('TrackPlayer init error:', e);
      // If it's already initialized, just set ready
      if (String(e).includes('already initialized')) {
        set({ isPlayerReady: true });
      }
    }
  },

  playTrack: async (track, queue = [track]) => {
    if (get().mode === 'listener' && !track.id.includes('force_sync')) {
      return;
    }
    
    if (!get().isPlayerReady) await get().initPlayer();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    set({ currentTrack: track, queue, hasCountedPlay: false });

    if (get().mode === 'host' && get().liveStationId) {
      supabase.from('live_stations').update({
        current_track_id: track.id,
        started_at: new Date().toISOString()
      }).eq('id', get().liveStationId).then(({ error }) => {
        if (error) console.error("Failed to update live station track:", error.message);
      });
    }

    const localUri = useOfflineStore.getState().getLocalUri(track.id);
    const url = localUri || track.audio_url;

    const tpTrack: TPTrack = {
      id: track.id,
      url: url,
      title: track.title,
      artist: track.artist_name || 'Unknown Artist',
      artwork: track.cover_url || 'https://via.placeholder.com/150',
      duration: track.duration_sec,
    };

    try {
      await TrackPlayer.reset();
      await TrackPlayer.add([tpTrack]);
      await TrackPlayer.setRate(get().playbackRate);
      await TrackPlayer.play();
    } catch (e) {
      console.log('TrackPlayer play error:', e);
    }
  },

  togglePlayPause: async () => {
    if (get().mode === 'listener') return;
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === TPState.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  },

  skipNext: async () => {
    if (get().mode === 'listener') return;
    const { queue, currentTrack, isShuffled, playTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const nextIdx = isShuffled
      ? Math.floor(Math.random() * queue.length)
      : (currentIdx + 1) % queue.length;
    await playTrack(queue[nextIdx], queue);
  },

  skipPrev: async () => {
    if (get().mode === 'listener') return;
    const { queue, currentTrack, playTrack } = get();
    if (!currentTrack) return;
    const position = await TrackPlayer.getProgress().then(p => p.position);
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : queue.length - 1;
    await playTrack(queue[prevIdx], queue);
  },

  seekTo: async (ms: number) => {
    if (get().mode === 'listener') return;
    await TrackPlayer.seekTo(ms / 1000);
  },

  setPlaybackRate: async (rate: number) => {
    set({ playbackRate: rate });
    await TrackPlayer.setRate(rate);
  },

  toggleShuffle: () => {
    set(s => ({ isShuffled: !s.isShuffled }));
  },

  toggleRepeat: () => {
    set(s => ({ repeatOne: !s.repeatOne }));
  },

  setSleepTimer: (minutes: number) => {
    if (get().sleepTimerInterval) clearInterval(get().sleepTimerInterval);
    const ms = minutes * 60 * 1000;
    const interval = setInterval(async () => {
      const state = get();
      if (state.sleepTimerMs !== null) {
        if (state.sleepTimerMs <= 1000) {
          clearInterval(state.sleepTimerInterval);
          await TrackPlayer.pause();
          set({ sleepTimerMs: null, sleepTimerInterval: null });
        } else {
          set({ sleepTimerMs: state.sleepTimerMs - 1000 });
        }
      }
    }, 1000);
    set({ sleepTimerMs: ms, sleepTimerInterval: interval });
  },

  clearSleepTimer: () => {
    if (get().sleepTimerInterval) clearInterval(get().sleepTimerInterval);
    set({ sleepTimerMs: null, sleepTimerInterval: null });
  },

  markPlayCounted: () => {
    set({ hasCountedPlay: true });
    const track = get().currentTrack;
    if (track) {
      supabase.rpc('increment_play_count', { track_id_input: track.id }).then();
    }
  },

  cleanup: async () => {
    await TrackPlayer.reset();
  },

  setMode: (mode: PlayerMode, stationId?: string) => {
    set({ mode, liveStationId: stationId || null });
    if (mode === 'listener') {
      TrackPlayer.pause();
    }
  },

  setVolume: async (volume: number) => {
    await TrackPlayer.setVolume(volume);
  },

  addTrackToQueue: (track: Track) => {
    set(s => {
      const exists = s.queue.some(t => t.id === track.id);
      if (exists) return s;
      const idx = s.currentTrack ? s.queue.findIndex(t => t.id === s.currentTrack!.id) : -1;
      const q = [...s.queue];
      if (idx !== -1) {
        q.splice(idx + 1, 0, track);
      } else {
        q.push(track);
      }
      return { queue: q };
    });
  },

  reorderQueue: (from: number, to: number) => {
    set(s => {
      const q = [...s.queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      return { queue: q };
    });
  }
}));

// Setup event listeners outside the store
TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async (event) => {
  const store = usePlayerStore.getState();
  if (event.position > 30 && !store.hasCountedPlay) {
    store.markPlayCounted();
  }
});

TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
  const store = usePlayerStore.getState();
  if (store.repeatOne) {
    await TrackPlayer.seekTo(0);
    await TrackPlayer.play();
  } else {
    store.skipNext();
  }
});
