import { create } from 'zustand';
import TrackPlayer, { Event, State as TPState, AppKilledPlaybackBehavior, Capability, IOSCategory, IOSCategoryMode, IOSCategoryOptions, PitchAlgorithm } from 'react-native-track-player';
import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { useAuthStore } from './authStore';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as React from 'react';

export enum State {
  None = 'none',
  Ready = 'ready',
  Playing = 'playing',
  Paused = 'paused',
  Stopped = 'stopped',
  Buffering = 'buffering',
  Loading = 'loading',
  Error = 'error',
}

function mapTPState(state: TPState): State {
  switch (state) {
    case TPState.Playing: return State.Playing;
    case TPState.Paused: return State.Paused;
    case TPState.Stopped: return State.Stopped;
    case TPState.Buffering: return State.Buffering;
    case TPState.Loading: return State.Loading;
    case TPState.Error: return State.Error;
    case TPState.Ready: return State.Ready;
    case TPState.None: return State.None;
    default: return State.None;
  }
}

type ProgressState = { position: number; duration: number; buffered: number };
let _progressListeners: ((p: ProgressState) => void)[] = [];
function notifyProgress(p: ProgressState) {
  _progressListeners.forEach(fn => fn(p));
}

export function useProgress(): ProgressState {
  const [progress, setProgress] = React.useState<ProgressState>({ position: 0, duration: 0, buffered: 0 });
  React.useEffect(() => {
    const listener = (p: ProgressState) => setProgress(p);
    _progressListeners.push(listener);
    const interval = setInterval(async () => {
        try {
            const p = await TrackPlayer.getProgress();
            notifyProgress({ position: p.position, duration: p.duration, buffered: p.buffered });
        } catch(e) {}
    }, 500);
    return () => { 
        _progressListeners = _progressListeners.filter(fn => fn !== listener); 
        clearInterval(interval);
    };
  }, []);
  return progress;
}

type PlaybackStateHook = { state: State };
let _playbackListeners: ((s: PlaybackStateHook) => void)[] = [];
let _currentPlaybackState: State = State.None;

function notifyPlaybackState(state: State) {
  _currentPlaybackState = state;
  _playbackListeners.forEach(fn => fn({ state }));
}

export function usePlaybackState(): PlaybackStateHook {
  const [pbState, setPbState] = React.useState<PlaybackStateHook>({ state: _currentPlaybackState });
  React.useEffect(() => {
    const listener = (s: PlaybackStateHook) => setPbState(s);
    _playbackListeners.push(listener);
    return () => { _playbackListeners = _playbackListeners.filter(fn => fn !== listener); };
  }, []);
  return pbState;
}

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
  pause: () => Promise<void>;
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
  removeTrackFromQueue: (index: number) => void;
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
      try {
        const { Audio } = require('expo-av');
        await Audio.setAudioModeAsync({ staysActiveInBackground: false, playsInSilentModeIOS: true });
      } catch (e) {}

      await TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        iosCategoryOptions: [IOSCategoryOptions.AllowBluetooth, IOSCategoryOptions.AllowBluetoothA2DP]
      });
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
    notifyPlaybackState(State.Loading);

    if (get().mode === 'host' && get().liveStationId) {
      supabase.from('live_stations').update({
        current_track_id: track.id,
        started_at: new Date().toISOString()
      }).eq('id', get().liveStationId).then(({ error }) => {
        if (error) console.error("Failed to update live station track:", error.message);
      });
    }

    const decryptedUri = await useOfflineStore.getState().getDecryptedUri(track.id);
    let url = decryptedUri || track.audio_url;

    if (url && typeof url === 'string') {
        url = url.replace(/ /g, '%20');
    }

    const tpTrack: any = {
      id: track.id,
      url: url,
      title: track.title,
      artist: track.artist_name || 'Unknown Artist',
      duration: track.duration_sec,
      pitchAlgorithm: PitchAlgorithm.Linear,
    };

    // If we are playing a downloaded file, omit the remote artwork URL entirely to prevent crashes.
    // Instead, pass the local bundled app icon so the native Lock Screen controller still renders correctly!
    if (!decryptedUri && track.cover_url) {
      tpTrack.artwork = track.cover_url;
    } else if (!decryptedUri) {
      tpTrack.artwork = 'https://via.placeholder.com/150';
    } else {
      tpTrack.artwork = require('../assets/icon.png');
    }

    try {
      await TrackPlayer.reset();
      await TrackPlayer.add([tpTrack]);
      await TrackPlayer.setRate(get().playbackRate);
      await TrackPlayer.play();
    } catch (e) {
      console.log('TrackPlayer play error:', e);
      if (get().currentTrack?.id === track.id) {
        notifyPlaybackState(State.Error);
      }
    }
  },

  togglePlayPause: async () => {
    if (get().mode === 'listener') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === TPState.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  },

  pause: async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === TPState.Playing) {
      await TrackPlayer.pause();
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
      const userId = useAuthStore.getState().session?.user?.id;
      supabase.rpc('increment_play_count', { 
        track_id_input: track.id,
        user_id_input: userId || null
      }).then();
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

  removeTrackFromQueue: (index: number) => {
    set(s => {
      const newQueue = [...s.queue];
      newQueue.splice(index, 1);
      return { queue: newQueue };
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

try {
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

  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    notifyPlaybackState(mapTPState(event.state));
  });
} catch(e) {}
