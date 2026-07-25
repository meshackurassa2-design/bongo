import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';
import { Track } from '../constants';

const SECRET_KEY = 'bongo_stream_offline_secure_key_2024';

type OfflineStore = {
  downloadedTracks: Record<string, Track & { localUri: string }>;
  isDownloading: Record<string, boolean>;
  downloadProgress: Record<string, number>;
  
  downloadTrack: (track: Track) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  isDownloaded: (trackId: string) => boolean;
  getLocalUri: (trackId: string) => string | null;
  getDecryptedUri: (trackId: string) => Promise<string | null>;
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
          let ext = track.audio_url.split('.').pop()?.split('?')[0] || 'mp3';
          if (!/^[a-zA-Z0-9]{2,4}$/.test(ext)) {
            ext = 'mp3';
          }
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
            // ENCRYPT THE FILE
            const base64Audio = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
            const encrypted = CryptoJS.AES.encrypt(base64Audio, SECRET_KEY).toString();
            
            const encUri = `${FileSystem.documentDirectory}track_${track.id}.enc`;
            await FileSystem.writeAsStringAsync(encUri, encrypted, { encoding: FileSystem.EncodingType.UTF8 });
            
            // Delete original unencrypted file
            await FileSystem.deleteAsync(result.uri, { idempotent: true });

            set((state) => ({
              downloadedTracks: {
                ...state.downloadedTracks,
                [track.id]: { ...track, localUri: encUri }
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
      
      getLocalUri: (trackId) => {
        return get().downloadedTracks[trackId]?.localUri || null;
      },

      getDecryptedUri: async (trackId) => {
        const track = get().downloadedTracks[trackId];
        if (!track || !track.localUri) return null;

        try {
          const encrypted = await FileSystem.readAsStringAsync(track.localUri, { encoding: FileSystem.EncodingType.UTF8 });
          const decryptedBytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
          const decryptedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
          
          if (!decryptedBase64) throw new Error("Decryption failed");

          const tempUri = `${FileSystem.cacheDirectory}temp_play_${track.id}.mp3`;
          await FileSystem.writeAsStringAsync(tempUri, decryptedBase64, { encoding: FileSystem.EncodingType.Base64 });
          
          return tempUri;
        } catch (e) {
          console.error("Decryption error:", e);
          return null;
        }
      },
    }),
    {
      name: 'bongo-offline-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === 1) {
          // Wipe old unencrypted tracks when migrating to v2
          return { downloadedTracks: {} };
        }
        return persistedState;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ downloadedTracks: state.downloadedTracks }), // Only persist completed downloads
    }
  )
);
