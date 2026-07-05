import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { COLORS, Track } from '../../constants';
import TrackItem from '../../components/TrackItem';
import CollaboratorModal from '../../components/CollaboratorModal';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const session = useAuthStore(s => s.session);

  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [colabModalVisible, setColabModalVisible] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    
    // Fetch Playlist
    const { data: playlistData } = await supabase.from('playlists').select('*, profile:profiles!playlists_user_id_fkey(*)').eq('id', id).single();
    if (playlistData) setPlaylist(playlistData);

    // Fetch Tracks
    const { data: pTracks } = await supabase.from('playlist_tracks').select('track_id').eq('playlist_id', id);
    if (pTracks && pTracks.length > 0) {
      const trackIds = pTracks.map(pt => pt.track_id);
      const { data: trackData } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').in('id', trackIds);
      if (trackData) setTracks(trackData as Track[]);
    }

    // Fetch Collaborators
    const { data: colabs } = await supabase.from('playlist_collaborators').select('*, profile:profiles!playlist_collaborators_user_id_fkey(*)').eq('playlist_id', id);
    if (colabs) setCollaborators(colabs);

    setLoading(false);
  };

  const inviteCollaborator = () => {
    setColabModalVisible(true);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={COLORS.gold} size="large" /></View>;
  if (!playlist) return <View style={styles.loader}><Text style={{color: '#fff'}}>Playlist not found</Text></View>;

  const isOwner = session?.user.id === playlist.user_id;

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[COLORS.cardAlt, COLORS.black, COLORS.black]} style={StyleSheet.absoluteFill} locations={[0, 0.4, 1]} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Playlist</Text>
        <View style={{ width: 44 }} />
      </View>
      
      <FlatList 
        showsVerticalScrollIndicator={false}
        data={tracks}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 160 }}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <View style={styles.cover}>
              <Ionicons name="musical-notes" size={80} color={COLORS.textTertiary} />
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={styles.name}>{playlist.title}</Text>
            </View>
            
            <View style={styles.privacyBadge}>
              <Ionicons name={playlist.is_public ? "earth" : "lock-closed"} size={14} color={COLORS.gold} />
              <Text style={styles.privacyText}>{playlist.is_public ? 'Public Playlist' : 'Private Playlist'}</Text>
            </View>
            
            <Text style={styles.stats}>Created by {playlist.profile?.display_name || 'Unknown'}</Text>

            <View style={styles.colabSection}>
              <Text style={styles.sectionTitle}>Collaborators ({collaborators.length})</Text>
              <View style={styles.avatarsRow}>
                {collaborators.map((c, i) => (
                  <View key={c.user_id} style={[styles.colabAvatar, { marginLeft: i > 0 ? -12 : 0 }]}>
                    <Text style={styles.avatarInitial}>{c.profile?.display_name?.charAt(0) || 'U'}</Text>
                  </View>
                ))}
                {isOwner && (
                  <TouchableOpacity style={[styles.colabAvatar, styles.addAvatar, { marginLeft: collaborators.length > 0 ? -12 : 0 }]} onPress={inviteCollaborator}>
                    <Ionicons name="add" size={20} color={COLORS.black} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.divider} />
          </View>
        }
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            isPlaying={currentTrack?.id === item.id}
            onPress={() => playTrack(item, tracks)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="musical-notes" size={48} color={COLORS.textTertiary} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 16 }}>No tracks added yet.</Text>
          </View>
        )}
      />
      
      <CollaboratorModal 
        visible={colabModalVisible} 
        onClose={() => {
          setColabModalVisible(false);
          loadData(); // Refresh collaborators list when modal closes
        }} 
        playlistId={id as string} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 10, zIndex: 10 },
  iconBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  profileHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  cover: { width: 180, height: 180, borderRadius: 16, backgroundColor: COLORS.card, marginBottom: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  name: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  stats: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 24 },
  divider: { height: 1, backgroundColor: COLORS.divider, width: width - 48, marginVertical: 32 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  
  colabSection: { alignItems: 'center', marginTop: 12 },
  avatarsRow: { flexDirection: 'row', alignItems: 'center' },
  colabAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardAlt, borderWidth: 2, borderColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  addAvatar: { backgroundColor: COLORS.gold, borderStyle: 'dashed' },
  privacyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  privacyText: { color: COLORS.gold, fontSize: 13, fontWeight: '700' },
});
