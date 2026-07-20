import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import { useOfflineStore } from '../../store/offlineStore';
import TrackItem from '../../components/TrackItem';

export default function LibraryScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'liked' | 'playlists' | 'uploads' | 'downloads'>('liked');
  const [uploads, setUploads] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistIsPublic, setNewPlaylistIsPublic] = useState(true);
  const { downloadedTracks } = useOfflineStore();

  useFocusEffect(
    useCallback(() => {
      if (session) loadLibrary();
    }, [session, tab])
  );

  const loadLibrary = async () => {
    setLoading(true);
    if (tab === 'liked') {
      const { data: likes } = await supabase.from('likes').select('track_id').eq('user_id', session!.user.id);
      if (likes && likes.length > 0) {
        const ids = likes.map(l => l.track_id);
        const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').in('id', ids).order('created_at', { ascending: false });
        if (data) setLikedTracks(data as Track[]);
      } else {
        setLikedTracks([]);
      }
    } else if (tab === 'playlists') {
      // Load user's owned playlists and playlists they collaborate on
      const { data: colabs } = await supabase.from('playlist_collaborators').select('playlist_id').eq('user_id', session!.user.id);
      const colabIds = colabs?.map(c => c.playlist_id) || [];
      
      const { data } = await supabase
        .from('playlists')
        .select('*')
        .or(`user_id.eq.${session!.user.id},id.in.(${colabIds.length ? colabIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: false });
      if (data) setPlaylists(data);
    } else if (tab === 'uploads') {
      const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', session!.user.id).order('created_at', { ascending: false });
      if (data) setUploads(data as Track[]);
    }
    setLoading(false);
  };

  const openCreatePlaylist = () => {
    setNewPlaylistTitle('');
    setNewPlaylistIsPublic(true);
    setCreateModalVisible(true);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim()) {
      Alert.alert("Required", "Please enter a name for your playlist");
      return;
    }
    
    setCreateModalVisible(false);
    
    const { error } = await supabase.from('playlists').insert({
      user_id: session!.user.id,
      title: newPlaylistTitle.trim(),
      is_public: newPlaylistIsPublic
    });
    
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      loadLibrary();
    }
  };

  const handleDeleteTrack = (track: Track) => {
    import('react-native').then(({ Alert }) => {
      Alert.alert(
        "Delete Song",
        `Are you sure you want to permanently delete "${track.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive", 
            onPress: async () => {
              const { error } = await supabase.from('tracks').delete().eq('id', track.id);
              if (error) {
                Alert.alert("Error", error.message);
              } else {
                setUploads(prev => prev.filter(t => t.id !== track.id));
              }
            }
          }
        ]
      );
    });
  };

  if (!session) {
    return (
      <View style={styles.noAuth}>
        <Text style={{ fontSize: 48 }}>🎵</Text>
        <Text style={styles.noAuthTitle}>Maktaba Yako</Text>
        <Text style={styles.noAuthText}>Ingia kuona nyimbo ulizopenda</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth')}>
          <Text style={styles.loginBtnText}>Ingia / Jisajili</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isArtist = session?.user?.user_metadata?.role === 'artist';
  const tracks = tab === 'liked' ? likedTracks : tab === 'uploads' ? uploads : Object.values(downloadedTracks);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Maktaba</Text>

      {/* Device Music Button */}
      <TouchableOpacity 
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.divider }}
        onPress={() => router.push('/local-music')}
      >
        <Ionicons name="phone-portrait-outline" size={24} color={COLORS.gold} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' }}>Device Music</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Play MP3s saved on your phone</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
      </TouchableOpacity>

      {/* Tabs */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'liked' && styles.tabActive]} onPress={() => setTab('liked')}>
            <Ionicons name="heart" size={16} color={tab === 'liked' ? COLORS.gold : COLORS.textTertiary} />
            <Text style={[styles.tabText, tab === 'liked' && styles.tabTextActive]}>Nilizopenda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'playlists' && styles.tabActive]} onPress={() => setTab('playlists')}>
            <Ionicons name="list" size={16} color={tab === 'playlists' ? COLORS.gold : COLORS.textTertiary} />
            <Text style={[styles.tabText, tab === 'playlists' && styles.tabTextActive]}>Playlists</Text>
          </TouchableOpacity>
          {isArtist && (
            <TouchableOpacity style={[styles.tab, tab === 'uploads' && styles.tabActive]} onPress={() => setTab('uploads')}>
              <Ionicons name="cloud-upload" size={16} color={tab === 'uploads' ? COLORS.gold : COLORS.textTertiary} />
              <Text style={[styles.tabText, tab === 'uploads' && styles.tabTextActive]}>Nilichopakia</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.tab, tab === 'downloads' && styles.tabActive]} onPress={() => setTab('downloads')}>
            <Ionicons name="download" size={16} color={tab === 'downloads' ? COLORS.gold : COLORS.textTertiary} />
            <Text style={[styles.tabText, tab === 'downloads' && styles.tabTextActive]}>Zilizopakuliwa</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : tab === 'playlists' ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.createPlaylistBtn} onPress={openCreatePlaylist}>
            <Ionicons name="add-circle" size={24} color={COLORS.gold} />
            <Text style={styles.createPlaylistText}>Create New Playlist</Text>
          </TouchableOpacity>
          <FlatList
            data={playlists}
            keyExtractor={p => p.id}
            contentContainerStyle={{ paddingBottom: 160, paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.playlistCard} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}>
                <View style={styles.playlistIcon}>
                  <Ionicons name="musical-notes" size={24} color={COLORS.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playlistTitle}>{item.title}</Text>
                  <Text style={styles.playlistSub}>
                    {item.is_public ? 'Public 🌍' : 'Private 🔒'} • {item.user_id === session?.user.id ? 'Owned by you' : 'Collaborative'} • {item.track_count || 0} Tracks
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.empty}>
                <Ionicons name="list" size={64} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>You haven't created any playlists yet</Text>
              </View>
            )}
          />
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name={tab === 'liked' ? 'heart-dislike' : tab === 'uploads' ? 'folder-open' : 'cloud-offline'} size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>
            {tab === 'liked' ? 'Bado hujapenda wimbo wowote' : tab === 'uploads' ? 'Bado hujapakia wimbo wowote' : 'Hujapakua nyimbo zozote za kusikiliza nje ya mtandao'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={t => t.id}
          contentContainerStyle={{ paddingBottom: 160 }}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              isPlaying={currentTrack?.id === item.id}
              onPress={() => {
                playTrack(item, tracks);
                router.push('/player');
              }}
              onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: item.user_id } })}
              onDelete={tab === 'uploads' ? () => handleDeleteTrack(item) : undefined}
            />
          )}
        />
      )}
      
      {/* Create Playlist Modal */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Playlist</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TextInput 
              style={styles.modalInput}
              placeholder="Playlist Name"
              placeholderTextColor={COLORS.textTertiary}
              value={newPlaylistTitle}
              onChangeText={setNewPlaylistTitle}
              autoFocus
            />
            
            <View style={styles.privacyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyLabel}>Public Playlist</Text>
                <Text style={styles.privacySub}>
                  {newPlaylistIsPublic ? 'Anyone can find and listen to this playlist.' : 'Only you and invited collaborators can view.'}
                </Text>
              </View>
              <Switch 
                value={newPlaylistIsPublic} 
                onValueChange={setNewPlaylistIsPublic}
                trackColor={{ false: COLORS.divider, true: COLORS.gold + '80' }}
                thumbColor={newPlaylistIsPublic ? COLORS.gold : COLORS.textSecondary}
              />
            </View>
            
            <TouchableOpacity style={styles.modalBtn} onPress={handleCreatePlaylist}>
              <Text style={styles.modalBtnText}>Create Playlist</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  title: { color: COLORS.gold, fontSize: 26, fontWeight: '900', marginHorizontal: 16, marginBottom: 16 },
  tabs: { paddingHorizontal: 16, gap: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.divider },
  tabActive: { backgroundColor: COLORS.gold + '20', borderColor: COLORS.gold },
  tabText: { color: COLORS.textTertiary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  noAuth: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAuthTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  noAuthText: { color: COLORS.textSecondary, fontSize: 14 },
  loginBtn: { backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  loginBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
  createPlaylistBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.1)', marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, gap: 12 },
  createPlaylistText: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  playlistCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 16, marginBottom: 12, gap: 16 },
  playlistIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' },
  playlistTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  playlistSub: { color: COLORS.textSecondary, fontSize: 13 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  modalInput: { backgroundColor: COLORS.black, color: COLORS.textPrimary, borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: COLORS.divider, marginBottom: 20 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, marginBottom: 24 },
  privacyLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  privacySub: { color: COLORS.textSecondary, fontSize: 12 },
  modalBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '700' },
});
