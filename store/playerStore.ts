import { create } from 'zustand';
import TrackPlayer, { Capability, State, Event } from 'react-native-track-player';
import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { useAuthStore } from './authStore';
import { supabase } from '../lib/supabase';

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
  isPlaying: boolean;
  
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
  isPlaying: false,

  initPlayer: async () => {
    if (get().isPlayerReady) return;
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        capabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious, Capability.Stop, Capability.SeekTo],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
      });

      TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
         set({ isPlaying: event.state === State.Playing });
      });

      TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
        set({ hasCountedPlay: false });
      });

      TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
         if (get().repeatOne) {
           TrackPlayer.seekTo(0);
           TrackPlayer.play();
         } else {
           get().skipNext();
         }
      });

      set({ isPlayerReady: true });
    } catch (e) {
      console.log("TrackPlayer setup error:", e);
    }
  },

  playTrack: async (track, queue = [track]) => {
    if (!get().isPlayerReady) await get().initPlayer();

    set({ currentTrack: track, queue, hasCountedPlay: false });

    const localUri = useOfflineStore.getState().getLocalUri(track.id);
    
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: track.id,
      url: localUri || track.audio_url,
      title: track.title,
      artist: track.artist_name || 'Unknown Artist',
      artwork: track.cover_url || undefined,
      duration: track.duration_sec || 0,
    });
    
    await TrackPlayer.setRate(get().playbackRate);
    await TrackPlayer.play();
  },

  togglePlayPause: async () => {
    const state = await TrackPlayer.getPlaybackState();
    if (state.state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  },

  skipNext: async () => {
    const { queue, currentTrack, isShuffled, playTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    let nextIdx = isShuffled ? Math.floor(Math.random() * queue.length) : (currentIdx + 1) % queue.length;
    await playTrack(queue[nextIdx], queue);
  },

  skipPrev: async () => {
    const { queue, currentTrack, playTrack } = get();
    if (!currentTrack) return;
    const progress = await TrackPlayer.getProgress();
    if (progress.position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : queue.length - 1;
    await playTrack(queue[prevIdx], queue);
  },

  seekTo: async (ms: number) => {
    await TrackPlayer.seekTo(ms / 1000);
  },

  setPlaybackRate: async (rate: number) => {
    set({ playbackRate: rate });
    await TrackPlayer.setRate(rate);
  },

  toggleShuffle: () => set(s => ({ isShuffled: !s.isShuffled })),
  
  toggleRepeat: () => set(s => ({ repeatOne: !s.repeatOne })),

  setSleepTimer: (minutes: number) => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    
    if (minutes <= 0) {
      get().clearSleepTimer();
      return;
    }

    const targetTimeMs = Date.now() + minutes * 60 * 1000;
    set({ sleepTimerMs: targetTimeMs });

    const interval = setInterval(async () => {
      const { sleepTimerMs } = get();
      if (!sleepTimerMs || Date.now() >= sleepTimerMs) {
        const state = await TrackPlayer.getPlaybackState();
        if (state.state === State.Playing) {
          await TrackPlayer.pause();
        }
        get().clearSleepTimer();
      }
    }, 1000);

    set({ sleepTimerInterval: interval });
  },

  clearSleepTimer: () => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    set({ sleepTimerMs: null, sleepTimerInterval: null });
  },

  markPlayCounted: () => {
    const { currentTrack, hasCountedPlay } = get();
    if (!currentTrack || hasCountedPlay) return;

    set({ hasCountedPlay: true });
    
    if (!currentTrack.id.startsWith('local_') && !(currentTrack as any).is_unpublished) {
      supabase.rpc('increment_play_count', { track_id: currentTrack.id }).then(({ error }) => {
        if (error) console.log("Failed to increment play count:", error.message);
      });
    
      const session = useAuthStore.getState().session;
      if (session?.user.id) {
        supabase.from('listening_history').insert({
          user_id: session.user.id,
          track_id: currentTrack.id,
          duration_listened: Math.floor(currentTrack.duration_sec || 30)
        }).then(({ error }) => {
           if (error) console.log("Failed to log history:", error.message);
        });
      }
    }
  },

  cleanup: async () => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    await TrackPlayer.reset();
    set({ currentTrack: null, sleepTimerMs: null, sleepTimerInterval: null });
  },
}));
