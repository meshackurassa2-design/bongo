import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Track } from '../constants';

type OfflineStore = {
  downloadedTracks: Record<string, Track & { localUri: string }>;
  isDownloading: Record<string, boolean>;
  downloadProgress: Record<string, number>;
  
  downloadTrack: (track: Track) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  isDownloaded: (trackId: string) => boolean;
  getLocalUri: (trackId: string) => string | null;
};

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      downloadedTracks: {},
      isDownloading: {},
      downloadProgress: {},

      downloadTrack: async (track) => {
        if (get().isDownloaded(track.id)) return;
        
        set((state) => ({
          isDownloading: { ...state.isDownloading, [track.id]: true },
          downloadProgress: { ...state.downloadProgress, [track.id]: 0 }
        }));

        try {
          // Determine extension (default mp3)
          const ext = track.audio_url.split('.').pop()?.split('?')[0] || 'mp3';
          const fileUri = `${FileSystem.documentDirectory}track_${track.id}.${ext}`;
          
          const downloadResumable = FileSystem.createDownloadResumable(
            track.audio_url,
            fileUri,
            {},
            (downloadProgress) => {
              const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
              set((state) => ({
                downloadProgress: { ...state.downloadProgress, [track.id]: progress }
              }));
            }
          );

          const result = await downloadResumable.downloadAsync();
          
          if (result && result.uri) {
            set((state) => ({
              downloadedTracks: {
                ...state.downloadedTracks,
                [track.id]: { ...track, localUri: result.uri }
              }
            }));
          }
        } catch (error) {
          console.error("Failed to download track:", error);
        } finally {
          set((state) => {
            const { [track.id]: _, ...restDownloading } = state.isDownloading;
            const { [track.id]: __, ...restProgress } = state.downloadProgress;
            return {
              isDownloading: restDownloading,
              downloadProgress: restProgress
            };
          });
        }
      },

      deleteDownload: async (trackId) => {
        const track = get().downloadedTracks[trackId];
        if (!track) return;
        
        try {
          await FileSystem.deleteAsync(track.localUri, { idempotent: true });
        } catch (error) {
          console.error("Failed to delete local file:", error);
        }
        
        set((state) => {
          const { [trackId]: _, ...rest } = state.downloadedTracks;
          return { downloadedTracks: rest };
        });
      },

      isDownloaded: (trackId) => !!get().downloadedTracks[trackId],
      
      getLocalUri: (trackId) => get().downloadedTracks[trackId]?.localUri || null,
    }),
    {
      name: 'bongo-offline-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ downloadedTracks: state.downloadedTracks }), // Only persist completed downloads
    }
  )
);
