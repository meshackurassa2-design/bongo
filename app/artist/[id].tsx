import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import TrackItem from '../../components/TrackItem';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function ArtistScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const session = useAuthStore(s => s.session);

  const [artist, setArtist] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [artistRes, tracksRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', id).eq('is_public', true).order('created_at', { ascending: false }),
      session ? supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', id) : Promise.resolve({ data: null })
    ]);
    
    if (artistRes.data) setArtist(artistRes.data);
    if (tracksRes.data) setTracks(tracksRes.data as Track[]);
    if (followRes.data && followRes.data.length > 0) setIsFollowing(true);
    
    setLoading(false);
  };

  const toggleFollow = async () => {
    if (!session) {
      router.push('/auth');
      return;
    }
    const previousState = isFollowing;
    setIsFollowing(!isFollowing); // Optimistic update
    
    try {
      if (previousState) {
        await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', id);
        setArtist((prev: any) => ({ ...prev, follower_count: Math.max(0, (prev.follower_count || 0) - 1) }));
      } else {
        await supabase.from('follows').insert({ follower_id: session.user.id, following_id: id });
        setArtist((prev: any) => ({ ...prev, follower_count: (prev.follower_count || 0) + 1 }));
      }
    } catch (e) {
      console.error(e);
      setIsFollowing(previousState); // Revert on failure
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color={COLORS.gold} size="large" /></View>;
  if (!artist) return <View style={styles.loader}><Text style={{color: '#fff'}}>Msanii hakupatikana</Text></View>;

  return (
    <View style={styles.container}>
      {/* Background Gradient matching cover art */}
      <View style={StyleSheet.absoluteFill}>
        {artist.avatar_url && (
          <Image source={{ uri: artist.avatar_url }} style={StyleSheet.absoluteFill} blurRadius={80} opacity={0.3} />
        )}
        <LinearGradient colors={['transparent', COLORS.black, COLORS.black]} style={StyleSheet.absoluteFill} locations={[0, 0.4, 1]} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profaili ya Msanii</Text>
        <View style={{ width: 44 }} />
      </View>
      
      <FlatList 
        showsVerticalScrollIndicator={false}
        data={tracks}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 160 }}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            {artist.avatar_url ? (
              <Image source={{ uri: artist.avatar_url }} style={styles.avatar} transition={300} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={80} color={COLORS.textTertiary} />
              </View>
            )}
            
            <View style={styles.nameRow}>
              <Text style={styles.name}>{artist.display_name}</Text>
              {artist.is_verified && <Ionicons name="checkmark-circle" size={24} color={COLORS.gold} />}
            </View>
            
            <View style={styles.statsRow}>
              <Text style={styles.stats}>{artist.follower_count || 0} Wafuasi</Text>
              <Text style={styles.statsDivider}>•</Text>
              <Text style={styles.stats}>{tracks.length} Nyimbo</Text>
            </View>

            <TouchableOpacity 
              style={[styles.followBtn, isFollowing ? styles.followingBtn : styles.notFollowingBtn]} 
              onPress={toggleFollow}
              activeOpacity={0.8}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Unafuatilia' : 'Fuatilia'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Nyimbo Zote</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            isPlaying={currentTrack?.id === item.id}
            onPress={() => playTrack(item, tracks)}
          />
        )}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 10, zIndex: 10 },
  iconBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  profileHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  avatar: { width: 180, height: 180, borderRadius: 90, marginBottom: 20, borderWidth: 4, borderColor: COLORS.gold, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  avatarFallback: { backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  name: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  stats: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  statsDivider: { color: COLORS.textTertiary, fontSize: 15 },
  followBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, borderWidth: 1, minWidth: 140, alignItems: 'center' },
  notFollowingBtn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  followingBtn: { backgroundColor: 'transparent', borderColor: COLORS.textSecondary },
  followBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.black },
  followingBtnText: { color: COLORS.textPrimary },
  divider: { height: 1, backgroundColor: COLORS.divider, width: width - 48, marginVertical: 32 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '800', alignSelf: 'flex-start', paddingHorizontal: 24, marginBottom: 16 },
});
