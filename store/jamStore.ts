import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Track } from '../constants';
import { usePlayerStore } from './playerStore';
import { RealtimeChannel } from '@supabase/supabase-js';

type JamRole = 'host' | 'guest' | null;

type JamStore = {
  sessionCode: string | null;
  role: JamRole;
  connectedGuests: number;
  jamQueue: Track[];
  activeChannel: RealtimeChannel | null;

  startJamSession: () => void;
  joinJamSession: (code: string) => Promise<boolean>;
  leaveJamSession: () => void;
  broadcastAddTrack: (track: Track) => void;
  broadcastSyncQueue: () => void;
};

export const useJamStore = create<JamStore>((set, get) => ({
  sessionCode: null,
  role: null,
  connectedGuests: 0,
  jamQueue: [],
  activeChannel: null,

  startJamSession: () => {
    get().leaveJamSession(); // cleanup any existing
    
    // Generate a random 4 letter code
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const channelName = `jam_${code}`;
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true },
        presence: { key: 'host' }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Calculate number of guests (excluding the host)
        let count = 0;
        for (const id in state) {
          count += state[id].length;
        }
        set({ connectedGuests: Math.max(0, count - 1) });
      })
      .on('broadcast', { event: 'ADD_TRACK' }, (payload) => {
        const track = payload.payload.track as Track;
        // Host receives a track, adds to their local playerStore queue
        usePlayerStore.getState().addTrackToQueue(track);
        get().broadcastSyncQueue();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user: 'host' });
          set({ sessionCode: code, role: 'host', activeChannel: channel });
          // Subscribe to playerStore changes so host automatically broadcasts queue updates
          usePlayerStore.subscribe((state, prevState) => {
            if (state.queue !== prevState.queue || state.currentTrack !== prevState.currentTrack) {
              get().broadcastSyncQueue();
            }
          });
          get().broadcastSyncQueue();
        }
      });
  },

  joinJamSession: async (code: string) => {
    get().leaveJamSession(); // cleanup any existing
    const channelName = `jam_${code.toUpperCase()}`;
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true },
        presence: { key: 'guest' }
      }
    });

    return new Promise((resolve) => {
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          let count = 0;
          for (const id in state) {
            count += state[id].length;
          }
          set({ connectedGuests: Math.max(0, count - 1) });
        })
        .on('broadcast', { event: 'SYNC_QUEUE' }, (payload) => {
          const { queue, currentTrack } = payload.payload;
          set({ jamQueue: queue });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user: 'guest' });
            set({ sessionCode: code.toUpperCase(), role: 'guest', activeChannel: channel });
            resolve(true);
          } else if (status === 'CHANNEL_ERROR') {
            resolve(false);
          }
        });
    });
  },

  leaveJamSession: () => {
    const { activeChannel } = get();
    if (activeChannel) {
      activeChannel.unsubscribe();
    }
    set({ sessionCode: null, role: null, activeChannel: null, connectedGuests: 0, jamQueue: [] });
  },

  broadcastAddTrack: (track: Track) => {
    const { activeChannel, role } = get();
    if (activeChannel && role === 'guest') {
      activeChannel.send({
        type: 'broadcast',
        event: 'ADD_TRACK',
        payload: { track }
      });
    }
  },

  broadcastSyncQueue: () => {
    const { activeChannel, role } = get();
    if (activeChannel && role === 'host') {
      const playerState = usePlayerStore.getState();
      activeChannel.send({
        type: 'broadcast',
        event: 'SYNC_QUEUE',
        payload: {
          queue: playerState.queue,
          currentTrack: playerState.currentTrack
        }
      });
    }
  }
}));
