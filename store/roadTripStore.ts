import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Track } from '../constants';
import { useAuthStore } from './authStore';
import { usePlayerStore } from './playerStore';

export type RoadTripState = {
  sessionId: string | null;
  isHost: boolean;
  participants: any[];
  sharedQueue: Track[];
  channel: RealtimeChannel | null;
  
  // Actions
  startRoadTrip: () => void;
  joinRoadTrip: (code: string) => Promise<boolean>;
  addTrack: (track: Track) => void;
  leaveRoadTrip: () => void;
  
  // Internal/Host sync
  syncState: (queue: Track[], currentTrack: Track | null) => void;
};

const generateCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

export const useRoadTripStore = create<RoadTripState>((set, get) => ({
  sessionId: null,
  isHost: false,
  participants: [],
  sharedQueue: [],
  channel: null,

  startRoadTrip: () => {
    const code = generateCode();
    const session = useAuthStore.getState().session;
    const userName = session?.user?.user_metadata?.display_name || 'Host';
    const userId = session?.user?.id || 'anonymous_host';

    const channel = supabase.channel(`roadtrip:${code}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const participants = Object.values(newState).flatMap(p => p);
        set({ participants });
        
        // Host broadcasts the current state to newly joined participants
        if (get().isHost) {
          const { queue, currentTrack } = usePlayerStore.getState();
          channel.send({
            type: 'broadcast',
            event: 'sync_state',
            payload: { queue, currentTrack }
          });
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('join', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('leave', key, leftPresences);
      })
      .on('broadcast', { event: 'add_track' }, (payload) => {
        if (get().isHost) {
          const { track } = payload.payload;
          const playerQueue = usePlayerStore.getState().queue;
          const currentTrack = usePlayerStore.getState().currentTrack;
          
          // Add to player queue
          const newQueue = [...playerQueue, track];
          usePlayerStore.setState({ queue: newQueue });
          
          // Broadcast updated state
          channel.send({
            type: 'broadcast',
            event: 'sync_state',
            payload: { queue: newQueue, currentTrack }
          });
          
          // Auto play if nothing is playing
          if (!currentTrack && playerQueue.length === 0) {
             usePlayerStore.getState().playTrack(track, newQueue);
          }
        }
      })
      .on('broadcast', { event: 'sync_state' }, (payload) => {
        if (!get().isHost) {
          const { queue, currentTrack } = payload.payload;
          set({ sharedQueue: queue });
          // Force update guest's player store to match (without playing audio)
          usePlayerStore.setState({ 
            queue, 
            currentTrack,
            // Prevent actual playing on guest device
            isPlaying: false 
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: userName,
            online_at: new Date().toISOString(),
          });
        }
      });

    set({ sessionId: code, isHost: true, channel });
    
    // Set initial shared queue from current player state
    const { queue } = usePlayerStore.getState();
    set({ sharedQueue: queue });
  },

  joinRoadTrip: async (code: string) => {
    return new Promise((resolve) => {
      const formattedCode = code.toUpperCase().trim();
      const session = useAuthStore.getState().session;
      const userName = session?.user?.user_metadata?.display_name || 'Guest';
      const userId = session?.user?.id || `guest_${Math.random().toString(36).substr(2, 9)}`;

      const channel = supabase.channel(`roadtrip:${formattedCode}`, {
        config: {
          presence: {
            key: userId,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          const participants = Object.values(newState).flatMap(p => p);
          set({ participants });
        })
        .on('broadcast', { event: 'sync_state' }, (payload) => {
          const { queue, currentTrack } = payload.payload;
          set({ sharedQueue: queue });
          usePlayerStore.setState({ 
            queue, 
            currentTrack,
            isPlaying: false 
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              name: userName,
              online_at: new Date().toISOString(),
            });
            set({ sessionId: formattedCode, isHost: false, channel });
            
            // Unload any current sound to ensure Guest device doesn't play
            const playerStore = usePlayerStore.getState();
            if (playerStore.sound) {
               playerStore.sound.unloadAsync();
               usePlayerStore.setState({ sound: null, isPlaying: false });
            }
            
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            resolve(false);
          }
        });
    });
  },

  addTrack: (track: Track) => {
    const { channel, isHost } = get();
    if (!channel) return;

    if (isHost) {
      // Host adds directly
      const playerQueue = usePlayerStore.getState().queue;
      const currentTrack = usePlayerStore.getState().currentTrack;
      const newQueue = [...playerQueue, track];
      usePlayerStore.setState({ queue: newQueue });
      set({ sharedQueue: newQueue });
      
      channel.send({
        type: 'broadcast',
        event: 'sync_state',
        payload: { queue: newQueue, currentTrack }
      });
      
      // If queue was empty, auto-play it
      if (!currentTrack && playerQueue.length === 0) {
        usePlayerStore.getState().playTrack(track, newQueue);
      }
    } else {
      // Guest requests addition
      channel.send({
        type: 'broadcast',
        event: 'add_track',
        payload: { track }
      });
    }
  },

  leaveRoadTrip: () => {
    const { channel } = get();
    if (channel) {
      channel.unsubscribe();
    }
    set({ sessionId: null, isHost: false, participants: [], sharedQueue: [], channel: null });
  },

  syncState: (queue: Track[], currentTrack: Track | null) => {
    const { channel, isHost } = get();
    if (isHost && channel) {
      channel.send({
        type: 'broadcast',
        event: 'sync_state',
        payload: { queue, currentTrack }
      });
      set({ sharedQueue: queue });
    }
  }
}));
