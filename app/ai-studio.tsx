import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { COLORS } from '../constants';
import { useAIStore, AISongTask } from '../store/aiStore';
import { generateMusic, getTaskInfo, SunoAudioData } from '../lib/sunoApi';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';

export default function AIStudioScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'workspace'>('create');

  // Create Form State
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { tasks, addTask, updateTask, removeTask } = useAIStore();
  const { session } = useAuthStore();

  const handleGenerate = async () => {
    if (!title || !style || !lyrics) {
      Alert.alert("Missing Fields", "Please fill out title, style, and lyrics.");
      return;
    }
    setIsGenerating(true);
    try {
      const taskId = await generateMusic(lyrics, style, title);
      addTask(taskId, title);
      setTitle('');
      setStyle('');
      setLyrics('');
      setActiveTab('workspace');
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'AI Studio', headerStyle: { backgroundColor: COLORS.card }, headerTintColor: COLORS.textPrimary, headerShown: false }} />
      
      {/* Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Studio</Text>
        <View style={{ width: 28 }} />
      </View>
      
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'create' && styles.activeTab]} onPress={() => setActiveTab('create')}>
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'workspace' && styles.activeTab]} onPress={() => setActiveTab('workspace')}>
          <Text style={[styles.tabText, activeTab === 'workspace' && styles.activeTabText]}>Workspace</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'create' ? (
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.label}>Song Title</Text>
          <TextInput style={styles.input} placeholder="e.g. Midnight Memories" placeholderTextColor={COLORS.textTertiary} value={title} onChangeText={setTitle} />
          
          <Text style={styles.label}>Musical Style (Genres / Vibes)</Text>
          <TextInput style={styles.input} placeholder="e.g. Acoustic pop, upbeat, female vocals" placeholderTextColor={COLORS.textTertiary} value={style} onChangeText={setStyle} />
          
          <Text style={styles.label}>Lyrics (Up to 3000 chars)</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Write your verses and chorus here..." placeholderTextColor={COLORS.textTertiary} value={lyrics} onChangeText={setLyrics} multiline textAlignVertical="top" />

          <TouchableOpacity style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]} onPress={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.generateBtnText}>Generate with AI</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>Your workspace is empty.</Text>
          ) : (
            tasks.map(task => <TaskItem key={task.taskId} task={task} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TaskItem({ task }: { task: AISongTask }) {
  const { updateTask, removeTask } = useAIStore();
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (task.status === 'PENDING' || task.status === 'PROCESSING') {
      interval = setInterval(async () => {
        try {
          const info = await getTaskInfo(task.taskId);
          // If status changed or tracks came in
          if (info.status !== task.status || (info.data && info.data.length > 0 && !task.tracks)) {
             updateTask(task.taskId, info.status, info.data);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 10000); // poll every 10 seconds
    }
    return () => clearInterval(interval);
  }, [task.status]);

  const handlePlay = async (track: SunoAudioData) => {
    const aiTrack = {
      id: track.id,
      audio_url: track.audioUrl,
      title: track.title || task.title,
      artist_name: 'AI Generated',
      cover_url: track.imageUrl || 'https://via.placeholder.com/150',
      duration: Math.floor(track.duration || 0),
      play_count: 0
    };
    await usePlayerStore.getState().playTrack(aiTrack as any);
  };

  const handlePublish = async (track: SunoAudioData) => {
    setIsPublishing(prev => ({ ...prev, [track.id]: true }));
    try {
      const { session } = useAuthStore.getState();
      if (!session) throw new Error("Not logged in");
      
      // 1. Download file to memory/cache
      const localAudioUri = FileSystem.cacheDirectory + `${track.id}.mp3`;
      await FileSystem.downloadAsync(track.audioUrl, localAudioUri);
      
      const localCoverUri = FileSystem.cacheDirectory + `${track.id}.jpg`;
      await FileSystem.downloadAsync(track.imageUrl, localCoverUri);

      // 2. Upload to Supabase Storage
      const audioFormData = new FormData();
      audioFormData.append('file', { uri: localAudioUri, name: `${track.id}.mp3`, type: 'audio/mpeg' } as any);
      
      const { data: audioData, error: audioErr } = await supabase.storage.from('audio').upload(`ai_tracks/${track.id}.mp3`, audioFormData);
      if (audioErr) throw audioErr;

      const coverFormData = new FormData();
      coverFormData.append('file', { uri: localCoverUri, name: `${track.id}.jpg`, type: 'image/jpeg' } as any);
      
      const { data: coverData, error: coverErr } = await supabase.storage.from('images').upload(`ai_covers/${track.id}.jpg`, coverFormData);
      if (coverErr) throw coverErr;

      // 3. Get Public URLs
      const audioPublicUrl = supabase.storage.from('audio').getPublicUrl(audioData.path).data.publicUrl;
      const coverPublicUrl = supabase.storage.from('images').getPublicUrl(coverData.path).data.publicUrl;

      // 4. Insert into 'tracks' table
      const { error: dbErr } = await supabase.from('tracks').insert({
        id: track.id,
        title: track.title || task.title,
        artist_id: session.user.id,
        audio_url: audioPublicUrl,
        cover_url: coverPublicUrl,
        duration: Math.floor(track.duration || 0),
        play_count: 0
      });
      if (dbErr) throw dbErr;

      Alert.alert("Success!", "Your AI song has been published to your fans!");
    } catch (e: any) {
      Alert.alert("Publish Error", e.message);
    } finally {
      setIsPublishing(prev => ({ ...prev, [track.id]: false }));
    }
  };

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <TouchableOpacity onPress={() => removeTask(task.taskId)}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
      
      {task.status === 'PENDING' || task.status === 'PROCESSING' ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={COLORS.gold} size="small" />
          <Text style={styles.statusText}>AI is composing... (Takes ~30 seconds)</Text>
        </View>
      ) : task.status === 'FAILED' ? (
        <Text style={[styles.statusText, { color: COLORS.error }]}>Generation Failed.</Text>
      ) : task.tracks ? (
        task.tracks.map(track => (
          <View key={track.id} style={styles.trackRow}>
            <Image source={{ uri: track.imageUrl }} style={styles.trackImg} cachePolicy="memory-disk" />
            <View style={{ flex: 1 }}>
               <Text style={styles.trackTitle}>{track.title || "AI Generated"}</Text>
               <View style={styles.trackActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handlePlay(track)}>
                    <Ionicons name="play" size={16} color={COLORS.black} />
                    <Text style={styles.actionText}>Play</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.cardAlt }]} onPress={() => handlePublish(track)}>
                    {isPublishing[track.id] ? <ActivityIndicator size="small" color={COLORS.textPrimary} /> : (
                      <>
                        <Ionicons name="cloud-upload" size={16} color={COLORS.gold} />
                        <Text style={[styles.actionText, { color: COLORS.textPrimary }]}>Publish</Text>
                      </>
                    )}
                  </TouchableOpacity>
               </View>
            </View>
          </View>
        ))
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabText: { color: COLORS.textSecondary, fontWeight: '600' },
  activeTabText: { color: COLORS.gold },
  content: { flex: 1 },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, padding: 14, borderRadius: 12, fontSize: 15 },
  textArea: { height: 180 },
  generateBtn: { backgroundColor: COLORS.gold, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  generateBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '700' },
  emptyText: { color: COLORS.textTertiary, textAlign: 'center', marginTop: 40 },
  taskCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  taskTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: COLORS.gold, fontSize: 13 },
  trackRow: { flexDirection: 'row', marginTop: 12, gap: 12, backgroundColor: COLORS.cardAlt, padding: 8, borderRadius: 8 },
  trackImg: { width: 60, height: 60, borderRadius: 8 },
  trackTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  trackActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  actionText: { color: COLORS.black, fontSize: 12, fontWeight: '700' },
});
