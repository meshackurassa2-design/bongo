import { create } from 'zustand';
import TrackPlayer, { Capability, AppKilledPlaybackBehavior, State, Event, Track as TPTrack } from 'react-native-track-player';
import { Track } from '../constants';
import { useOfflineStore } from './offlineStore';

type PlayerStore = {
  currentTrack: Track | null;
  queue: Track[];
  isPlayerReady: boolean;
  hasCountedPlay: boolean;
  isShuffled: boolean;
  repeatOne: boolean;
  // Actions
  setupPlayer: () => Promise<void>;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  markPlayCounted: () => void;
  cleanup: () => Promise<void>;
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlayerReady: false,
  hasCountedPlay: false,
  isShuffled: false,
  repeatOne: false,

  setupPlayer: async () => {
    if (get().isPlayerReady) return;
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
      });
      set({ isPlayerReady: true });
    } catch (e) {
      console.log('Player already setup or error:', e);
      set({ isPlayerReady: true });
    }
  },

  playTrack: async (track, queue = [track]) => {
    const { isPlayerReady, setupPlayer } = get();
    if (!isPlayerReady) await setupPlayer();

    set({ currentTrack: track, queue, hasCountedPlay: false });

    const localUri = useOfflineStore.getState().getLocalUri(track.id);
    const audioUrl = localUri ? localUri : track.audio_url;

    const tpTrack: TPTrack = {
      id: track.id,
      url: audioUrl,
      title: track.title,
      artist: track.profile?.display_name || 'Unknown Artist',
      artwork: track.cover_url || 'https://via.placeholder.com/150',
    };

    await TrackPlayer.reset();
    await TrackPlayer.add([tpTrack]);
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
    let nextIdx: number;
    if (isShuffled) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = (currentIdx + 1) % queue.length;
    }
    await playTrack(queue[nextIdx], queue);
  },

  skipPrev: async () => {
    const { queue, currentTrack, playTrack } = get();
    if (!currentTrack) return;
    
    const position = await TrackPlayer.getProgress();
    if (position.position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }

    const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : queue.length - 1;
    await playTrack(queue[prevIdx], queue);
  },

  seekTo: async (ms: number) => {
    await TrackPlayer.seekTo(ms / 1000); // TrackPlayer uses seconds!
  },

  toggleShuffle: () => set(s => ({ isShuffled: !s.isShuffled })),
  toggleRepeat: () => set(s => ({ repeatOne: !s.repeatOne })),
  
  markPlayCounted: () => set({ hasCountedPlay: true }),

  cleanup: async () => {
    await TrackPlayer.reset();
    set({ currentTrack: null });
  },
}));
