import { create } from 'zustand';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';
import { useAuthStore } from './authStore';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import MusicControl, { Command } from 'react-native-music-control';

// ── Fake State enum matching TrackPlayer's API surface so UI components don't need to change ──
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

// ── Sound singleton ──
let _sound: Audio.Sound | null = null;
let _positionMs = 0;
let _durationMs = 0;

// ── Progress hook state (replaces useProgress from TrackPlayer) ──
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
    return () => { _progressListeners = _progressListeners.filter(fn => fn !== listener); };
  }, []);
  return progress;
}

// ── Playback state hook (replaces usePlaybackState from TrackPlayer) ──
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

import React from 'react';

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
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      MusicControl.enableBackgroundMode(true);
      MusicControl.enableControl('play', true);
      MusicControl.enableControl('pause', true);
      MusicControl.enableControl('nextTrack', true);
      MusicControl.enableControl('previousTrack', true);
      MusicControl.enableControl('seek', true);

      MusicControl.on(Command.play, () => { get().togglePlayPause(); });
      MusicControl.on(Command.pause, () => { get().togglePlayPause(); });
      MusicControl.on(Command.nextTrack, () => { get().skipNext(); });
      MusicControl.on(Command.previousTrack, () => { get().skipPrev(); });
      MusicControl.on(Command.seek, (time) => { get().seekTo(time * 1000); });

      set({ isPlayerReady: true });
    } catch (e) {
      console.log('expo-av Audio init error:', e);
      set({ isPlayerReady: true });
    }
  },

  playTrack: async (track, queue = [track]) => {
    if (get().mode === 'listener' && !track.id.includes('force_sync')) {
      // Listeners cannot manually play tracks unless it's a forced sync from the host
      return;
    }
    
    if (!get().isPlayerReady) await get().initPlayer();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    set({ currentTrack: track, queue, hasCountedPlay: false });
    notifyPlaybackState(State.Loading);



    // If host, update the database
    if (get().mode === 'host' && get().liveStationId) {
      supabase.from('live_stations').update({
        current_track_id: track.id,
        started_at: new Date().toISOString()
      }).eq('id', get().liveStationId).then(({ error }) => {
        if (error) console.error("Failed to update live station track:", error.message);
      });
    }

    // Unload previous sound
    if (_sound) {
      const oldSound = _sound;
      _sound = null;
      await oldSound.unloadAsync().catch(() => {});
    }

    const localUri = useOfflineStore.getState().getLocalUri(track.id);
    const url = localUri || track.audio_url;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, rate: get().playbackRate, shouldCorrectPitch: false, progressUpdateIntervalMillis: 500 },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          _positionMs = status.positionMillis;
          _durationMs = status.durationMillis ?? 0;
          
          notifyProgress({
            position: status.positionMillis / 1000,
            duration: (status.durationMillis ?? 0) / 1000,
            buffered: (status.playableDurationMillis ?? 0) / 1000,
          });

          try {
            if (status.isPlaying) {
              notifyPlaybackState(State.Playing);
              MusicControl.updatePlayback({ state: MusicControl.STATE_PLAYING, elapsedTime: status.positionMillis / 1000 });
            } else if (status.isBuffering) {
              notifyPlaybackState(State.Buffering);
              MusicControl.updatePlayback({ state: MusicControl.STATE_BUFFERING, elapsedTime: status.positionMillis / 1000 });
            } else {
              notifyPlaybackState(State.Paused);
              MusicControl.updatePlayback({ state: MusicControl.STATE_PAUSED, elapsedTime: status.positionMillis / 1000 });
            }
          } catch(e) {}

          // Track ended
          if (status.didJustFinish) {
            const store = usePlayerStore.getState();
            if (store.repeatOne) {
              _sound?.replayAsync();
            } else {
              store.skipNext();
            }
          }

          // Count play after 30s
          if (status.positionMillis > 30000 && !get().hasCountedPlay) {
            get().markPlayCounted();
          }
        }
      );
      
      // RACE CONDITION FIX: 
      // If the user skipped to a new track while this one was loading over the network,
      // unload this stale audio instantly and do not set _sound.
      if (get().currentTrack?.id !== track.id) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      
      _sound = sound;

      try {
        MusicControl.setNowPlaying({
          title: track.title,
          artwork: track.cover_url || 'https://via.placeholder.com/150',
          artist: track.artist_name || 'Unknown Artist',
          duration: track.duration_sec || 0, 
        });
        MusicControl.updatePlayback({ state: MusicControl.STATE_PLAYING, elapsedTime: 0 });
      } catch (e) {
        console.log('MusicControl error:', e);
      }
    } catch (e) {
      console.log('expo-av playTrack error:', e);
      // Only set error state if this is still the active track
      if (get().currentTrack?.id === track.id) {
        notifyPlaybackState(State.Error);
      }
    }
  },

  togglePlayPause: async () => {
    if (get().mode === 'listener') return; // Listeners can't pause
    if (!_sound) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const status = await _sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await _sound.pauseAsync();
      notifyPlaybackState(State.Paused);
    } else {
      await _sound.playAsync();
      notifyPlaybackState(State.Playing);
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
    // If more than 3s in, restart
    if (_positionMs > 3000) {
      await _sound?.setPositionAsync(0);
      return;
    }
    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : queue.length - 1;
    await playTrack(queue[prevIdx], queue);
  },

  seekTo: async (ms: number) => {
    if (get().mode === 'listener') return;
    await _sound?.setPositionAsync(ms);
  },

  setPlaybackRate: async (rate: number) => {
    set({ playbackRate: rate });
    // shouldCorrectPitch: false → pitch rises with speed = chipmunk effect
    await _sound?.setRateAsync(rate, false);
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
        await _sound?.pauseAsync();
        notifyPlaybackState(State.Paused);
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
        if (error) console.log('Failed to increment play count:', error.message);
      });

      const session = useAuthStore.getState().session;
      if (session?.user.id) {
        supabase.from('listening_history').insert({
          user_id: session.user.id,
          track_id: currentTrack.id,
          duration_listened: Math.floor(currentTrack.duration_sec || 30),
        }).then(({ error }) => {
          if (error) console.log('Failed to log history:', error.message);
        });
      }
    }
  },

  cleanup: async () => {
    const { sleepTimerInterval } = get();
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    if (_sound) {
      await _sound.unloadAsync();
      _sound = null;
    }
    notifyPlaybackState(State.None);
    set({ currentTrack: null, sleepTimerMs: null, sleepTimerInterval: null, mode: 'local', liveStationId: null });
  },

  setMode: (mode: PlayerMode, stationId?: string) => set({ mode, liveStationId: stationId || null }),

  setVolume: async (volume: number) => {
    await _sound?.setVolumeAsync(volume);
  },

  addTrackToQueue: (track: Track) => {
    set(state => ({ queue: [...state.queue, track] }));
  },

  reorderQueue: (from, to) => {
    const queue = [...get().queue];
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    set({ queue });
  }
}));
