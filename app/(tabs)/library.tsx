import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { COLORS, Track } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import { useOfflineStore } from '../../store/offlineStore';
import TrackItem from '../../components/TrackItem';

export default function LibraryScreen() {
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'liked' | 'uploads' | 'downloads'>('liked');
  const [uploads, setUploads] = useState<Track[]>([]);
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
    } else if (tab === 'uploads') {
      const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', session!.user.id).order('created_at', { ascending: false });
      if (data) setUploads(data as Track[]);
    }
    setLoading(false);
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

      {/* Tabs */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'liked' && styles.tabActive]} onPress={() => setTab('liked')}>
          <Ionicons name="heart" size={16} color={tab === 'liked' ? COLORS.gold : COLORS.textTertiary} />
          <Text style={[styles.tabText, tab === 'liked' && styles.tabTextActive]}>Nilizopenda</Text>
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

      {loading
        ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
        : tracks.length === 0
          ? (
            <View style={styles.empty}>
              <Ionicons name={tab === 'liked' ? 'heart-dislike' : tab === 'uploads' ? 'folder-open' : 'cloud-offline'} size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {tab === 'liked' ? 'Bado hujapenda wimbo wowote' : tab === 'uploads' ? 'Bado hujapakia wimbo wowote' : 'Hujapakua nyimbo zozote za kusikiliza nje ya mtandao'}
              </Text>
            </View>
          )
          : (
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
                />
              )}
            />
          )
      }
    </View>
  );
}

const styles = StyleSheet.create({
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
});
