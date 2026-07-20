import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { getTaskInfo, SunoAudioData, createMusicVideo, getVideoRecordInfo } from '../../lib/sunoApi';
import { useAIStore, AISongTask } from '../../store/aiStore';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import { useThemeStore } from '../../store/themeStore';


interface WorkspaceTabProps {
  openPersonaModal: (audioId: string) => void;
}

export default function WorkspaceTab({ openPersonaModal }: WorkspaceTabProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { tasks } = useAIStore();
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<Record<string, boolean>>({});

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Your AI Assets</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyText}>Your workspace is empty.</Text>
          <Text style={styles.emptySub}>Generate or cover audio to see it here.</Text>
        </View>
      ) : (
        tasks.map(task => (
          <TaskItem 
            key={task.taskId} 
            task={task} 
            isPublishing={isPublishing} 
            setIsPublishing={setIsPublishing} 
            isDownloading={isDownloading} 
            setIsDownloading={setIsDownloading} 
            isGeneratingVideo={isGeneratingVideo}
            setIsGeneratingVideo={setIsGeneratingVideo}
            openPersonaModal={openPersonaModal}
          />
        ))
      )}
    </ScrollView>
  );
}

function TaskItem({ task, isPublishing, setIsPublishing, isDownloading, setIsDownloading, isGeneratingVideo, setIsGeneratingVideo, openPersonaModal }: { task: AISongTask, isPublishing: any, setIsPublishing: any, isDownloading: any, setIsDownloading: any, isGeneratingVideo: any, setIsGeneratingVideo: any, openPersonaModal: (id: string) => void }) {
  const router = useRouter();
  const { updateTask, removeTask, updateTrack } = useAIStore();
  const [pollError, setPollError] = useState<string | null>(null);

  const handleGenerateVideo = async (track: SunoAudioData) => {
    setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      const mp4TaskId = await createMusicVideo(task.taskId, track.id);
      
      const interval = setInterval(async () => {
        try {
          const info = await getVideoRecordInfo(mp4TaskId);
          if (info.status === 'success') {
            clearInterval(interval);
            updateTrack(task.taskId, track.id, { videoUrl: info.videoUrl });
            setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: false }));
            Alert.alert("Success", "Music Video generated!");
          } else if (info.status === 'failed') {
            clearInterval(interval);
            setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: false }));
            Alert.alert("Error", "Video generation failed.");
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000);
      
    } catch (e: any) {
      setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: false }));
      Alert.alert("Video Error", e.message);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (task.status === 'PENDING' || task.status === 'PROCESSING') {
      interval = setInterval(async () => {
        try {
          const info = await getTaskInfo(task.taskId);
          setPollError(null);
          
          const hasTracks = info.data && info.data.length > 0 && (info.data[0].sourceAudioUrl || info.data[0].audioUrl || info.data[0].streamAudioUrl);
          
          if (hasTracks && info.data) {
             const mappedData = info.data.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.streamAudioUrl || t.sourceAudioUrl }));
             updateTask(task.taskId, 'SUCCESS', mappedData);
          } else if (info.status === 'SENSITIVE_WORD_ERROR') {
             updateTask(task.taskId, 'SENSITIVE_WORD_ERROR');
          } else if (info.status === 'FAILED' || info.status?.includes('ERROR')) {
             updateTask(task.taskId, 'FAILED');
          } else if (info.status === 'SUCCESS' && !hasTracks) {
             updateTask(task.taskId, 'FAILED');
          }
        } catch (e: any) {
          setPollError(e.message || "Network error");
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [task.status]);

  const manualCheck = async () => {
    try {
      const info = await getTaskInfo(task.taskId);
      const hasTracks = info.data && info.data.length > 0 && (info.data[0].sourceAudioUrl || info.data[0].audioUrl || info.data[0].streamAudioUrl);
      if (hasTracks && info.data) {
        const mappedData = info.data.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.streamAudioUrl || t.sourceAudioUrl }));
        updateTask(task.taskId, 'SUCCESS', mappedData);
      } else if (info.status === 'SENSITIVE_WORD_ERROR') {
        updateTask(task.taskId, 'SENSITIVE_WORD_ERROR');
      } else if (info.status === 'FAILED' || (info.status === 'SUCCESS' && !hasTracks)) {
        updateTask(task.taskId, 'FAILED');
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handlePlay = async (track: SunoAudioData) => {
    try {
      let playTrackData = track;
      let targetUrl = track.audioUrl || (track as any).audio_url || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
      
      if (targetUrl?.includes('cdn1.suno.ai') || targetUrl?.includes('tempfile.aiquickdraw.com')) {
        const fetchPromise = getTaskInfo(task.taskId);
        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        const info = await Promise.race([fetchPromise, timeoutPromise]);
        if (info && info.data && info.data.length > 0) {
          const freshTrack = info.data.find((t: any) => t.id === track.id);
          if (freshTrack) {
            playTrackData = { ...freshTrack, audioUrl: freshTrack.audioUrl || freshTrack.audio_url || freshTrack.streamAudioUrl || freshTrack.sourceAudioUrl } as any;
            targetUrl = playTrackData.audioUrl;
            const mappedData = info.data.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.audio_url || t.streamAudioUrl || t.sourceAudioUrl }));
            updateTask(task.taskId, 'SUCCESS', mappedData);
          }
        }
      }

      if (!targetUrl) {
        Alert.alert("Error", "No audio URL found for this track.");
        return;
      }

      const { profile } = useAuthStore.getState();
      const aiTrack = {
        id: playTrackData.id,
        audio_url: targetUrl,
        title: playTrackData.title || task.title,
        artist_name: profile?.display_name || 'AI Generated',
        cover_url: playTrackData.imageUrl || (playTrackData as any).image_url || 'https://via.placeholder.com/150',
        video_url: playTrackData.videoUrl || track.videoUrl,
        duration: Math.floor(playTrackData.duration || 0),
        play_count: 0
      };

      usePlayerStore.getState().playTrack(aiTrack as any);
      router.push('/player');
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handlePublish = async (track: SunoAudioData) => {
    setIsPublishing((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      const { session, profile } = useAuthStore.getState();
      if (!session) throw new Error("Not logged in");
      
      let targetAudioUrl = track.audioUrl || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
      let targetCoverUrl = track.imageUrl;
      
      if (targetAudioUrl?.includes('cdn1.suno.ai') || targetAudioUrl?.includes('tempfile.aiquickdraw.com')) {
        const info = await getTaskInfo(task.taskId);
        if (info.data && info.data.length > 0) {
          const freshTrack = info.data.find(t => t.id === track.id);
          if (freshTrack) {
            targetAudioUrl = freshTrack.audioUrl || freshTrack.streamAudioUrl || freshTrack.sourceAudioUrl;
            targetCoverUrl = freshTrack.imageUrl;
          }
        }
      }

      const localAudioUri = FileSystem.cacheDirectory + `${track.id}.mp3`;
      await FileSystem.downloadAsync(targetAudioUrl, localAudioUri);
      
      const localCoverUri = FileSystem.cacheDirectory + `${track.id}.jpg`;
      await FileSystem.downloadAsync(targetCoverUrl, localCoverUri);

      const audioBase64 = await FileSystem.readAsStringAsync(localAudioUri, { encoding: FileSystem.EncodingType.Base64 });
      const coverBase64 = await FileSystem.readAsStringAsync(localCoverUri, { encoding: FileSystem.EncodingType.Base64 });

      const { error: audioErr } = await supabase.storage.from('audio').upload(`ai_tracks/${track.id}.mp3`, decode(audioBase64), { contentType: 'audio/mpeg' });
      if (audioErr) throw audioErr;

      const { error: coverErr } = await supabase.storage.from('images').upload(`ai_covers/${track.id}.jpg`, decode(coverBase64), { contentType: 'image/jpeg' });
      if (coverErr) throw coverErr;

      const audioPublicUrl = supabase.storage.from('audio').getPublicUrl(`ai_tracks/${track.id}.mp3`).data.publicUrl;
      const coverPublicUrl = supabase.storage.from('images').getPublicUrl(`ai_covers/${track.id}.jpg`).data.publicUrl;

      const { error: dbErr } = await supabase.from('tracks').insert({
        user_id: session.user.id,
        artist_name: profile?.display_name || session.user.user_metadata?.display_name || 'AI Artist',
        title: track.title || task.title,
        audio_url: audioPublicUrl,
        cover_url: coverPublicUrl,
        duration_sec: Math.floor(track.duration || 0),
        play_count: 0,
        is_public: true,
        is_ai: true,
      });
      if (dbErr) throw dbErr;

      Alert.alert("Success", "Song published to your profile!");
    } catch (e: any) {
      Alert.alert("Publish Error", e.message);
    } finally {
      setIsPublishing((prev: any) => ({ ...prev, [track.id]: false }));
    }
  };

  const handleDownload = async (track: SunoAudioData) => {
    setIsDownloading((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      let targetAudioUrl = track.audioUrl || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
      if (targetAudioUrl?.includes('cdn1.suno.ai') || targetAudioUrl?.includes('tempfile.aiquickdraw.com')) {
        const info = await getTaskInfo(task.taskId);
        if (info.data && info.data.length > 0) {
          const freshTrack = info.data.find(t => t.id === track.id);
          if (freshTrack) {
            targetAudioUrl = freshTrack.audioUrl || freshTrack.streamAudioUrl || freshTrack.sourceAudioUrl;
          }
        }
      }

      const localAudioUri = FileSystem.documentDirectory + `${(track.title || 'AI_Song').replace(/[^a-z0-9]/gi, '_')}.mp3`;
      await FileSystem.downloadAsync(targetAudioUrl, localAudioUri);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localAudioUri);
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (e: any) {
      Alert.alert("Download Error", e.message);
    } finally {
      setIsDownloading((prev: any) => ({ ...prev, [track.id]: false }));
    }
  };

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <TouchableOpacity onPress={() => removeTask(task.taskId)} style={styles.trashBtn}>
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
        </TouchableOpacity>
      </View>
      
      {task.status === 'PENDING' || task.status === 'PROCESSING' ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={COLORS.gold} size="small" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.statusText}>
              {pollError ? `Retrying... (${pollError})` : 'AI is composing...'}
            </Text>
          </View>
          <TouchableOpacity onPress={manualCheck} style={styles.checkBtn}>
            <Text style={{ color: COLORS.gold, fontSize: 11, fontWeight: '800' }}>CHECK</Text>
          </TouchableOpacity>
        </View>
      ) : task.status === 'SENSITIVE_WORD_ERROR' ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color={COLORS.error} />
          <Text style={[styles.statusText, { color: COLORS.error, marginLeft: 8 }]}>Generation Failed: Sensitive words.</Text>
        </View>
      ) : task.status === 'FAILED' ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color={COLORS.error} />
          <Text style={[styles.statusText, { color: COLORS.error, marginLeft: 8 }]}>Generation Failed.</Text>
        </View>
      ) : Array.isArray(task.tracks) && task.tracks.length > 0 ? (
        task.tracks.map(track => (
          <View key={track.id} style={styles.trackRow}>
            <TouchableOpacity onPress={() => handlePlay(track)}>
              <Image source={{ uri: track.imageUrl }} style={styles.trackImg} cachePolicy="memory-disk" />
              <View style={styles.playOverlay}>
                <Ionicons name="play" size={24} color="#FFF" />
              </View>
            </TouchableOpacity>
            
            <View style={{ flex: 1, justifyContent: 'space-between', marginLeft: 12 }}>
              <TouchableOpacity onPress={() => handlePlay(track)}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title || "AI Generated"}</Text>
              </TouchableOpacity>
              
              <View style={styles.trackActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => handlePublish(track)}>
                  {isPublishing[track.id] ? <ActivityIndicator size="small" color={COLORS.gold} /> : (
                    <>
                      <Ionicons name="cloud-upload" size={14} color={COLORS.gold} />
                      <Text style={[styles.actionText, { color: COLORS.gold }]}>Publish</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDownload(track)}>
                  {isDownloading[track.id] ? <ActivityIndicator size="small" color={COLORS.textPrimary} /> : (
                    <Ionicons name="download-outline" size={18} color={COLORS.textPrimary} />
                  )}
                </TouchableOpacity>

                {!track.videoUrl ? (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleGenerateVideo(track)}>
                    {isGeneratingVideo[track.id] ? <ActivityIndicator size="small" color={COLORS.textPrimary} /> : (
                      <Ionicons name="videocam-outline" size={18} color={COLORS.textPrimary} />
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <Ionicons name="videocam" size={18} color={COLORS.gold} />
                  </View>
                )}

                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]} onPress={() => openPersonaModal(track.id)}>
                  <Ionicons name="person-add" size={18} color={COLORS.gold} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.statusText}>Formatting tracks...</Text>
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 20 },
  emptyText: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: COLORS.textTertiary, fontSize: 14, marginTop: 8 },
  
  taskCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  taskTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  trashBtn: { padding: 6, backgroundColor: 'rgba(255, 59, 48, 0.1)', borderRadius: 8 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 12, borderRadius: 12 },
  statusText: { color: COLORS.gold, fontSize: 13, fontWeight: '600' },
  checkBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 12, borderRadius: 12 },
  
  trackRow: { flexDirection: 'row', marginTop: 8, padding: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  trackImg: { width: 70, height: 70, borderRadius: 10 },
  playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  trackTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  trackActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { paddingHorizontal: 12, height: 32, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 12, fontWeight: '700' },
});
