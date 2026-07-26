import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
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
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', id).eq('is_public', true).order('play_count', { ascending: false }),
      session ? supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', id) : Promise.resolve({ data: null })
    ]);
    
    if (artistRes.data) setArtist(artistRes.data);
    if (tracksRes.data) setTracks(tracksRes.data as Track[]);
    if (followRes.data && followRes.data.length > 0) setIsFollowing(true);
    
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`artist-tracks-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracks', filter: `user_id=eq.${id}` }, (payload) => {
        setTracks(prev => prev.map(t => t.id === payload.new.id ? { ...t, play_count: payload.new.play_count } : t));
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const toggleFollow = async () => {
    if (!session) {
      router.push('/auth');
      return;
    }
    const previousState = isFollowing;
    setIsFollowing(!isFollowing); 
    
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
      setIsFollowing(previousState);
    }
  };

  const playArtist = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1DB954" size="large" /></View>;
  if (!artist) return <View style={styles.loader}><Text style={{color: '#fff'}}>Artist not found</Text></View>;

  return (
    <View style={styles.container}>
      {/* Absolute Back Button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>

      <FlatList 
        showsVerticalScrollIndicator={false}
        data={tracks}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 160 }}
        ListHeaderComponent={
          <View>
            {/* Hero Image Section */}
            <View style={styles.heroContainer}>
              {artist.avatar_url ? (
                <Image source={{ uri: artist.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#333' }]} />
              )}
              <LinearGradient 
                colors={['transparent', 'rgba(0,0,0,0.6)', COLORS.black]} 
                locations={[0.3, 0.7, 1]} 
                style={StyleSheet.absoluteFill} 
              />
              <Text style={styles.heroName} numberOfLines={2}>{artist.display_name}</Text>
            </View>

            <View style={styles.contentPadding}>
              <Text style={styles.listenersText}>{tracks.reduce((sum, t) => sum + (t.play_count || 0), 0).toLocaleString()} monthly listeners</Text>
              
              {/* Action Row */}
              <View style={styles.actionRow}>
                <View style={styles.actionLeft}>
                  <TouchableOpacity style={styles.followBtn} onPress={toggleFollow}>
                    <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ padding: 8 }}>
                    <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.actionRight}>
                  <TouchableOpacity style={{ padding: 8 }}>
                    <Ionicons name="shuffle" size={32} color="#1DB954" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.playBtn} activeOpacity={0.8} onPress={playArtist}>
                    <Ionicons name="play" size={28} color="#000" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.popularTitle}>Popular</Text>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.trackRow} onPress={() => playTrack(item, tracks)}>
            <Text style={styles.trackIndex}>{index + 1}</Text>
            <Image source={{ uri: item.cover_url || artist.avatar_url }} style={styles.trackCover} contentFit="cover" />
            <View style={styles.trackInfo}>
              <Text style={[styles.trackTitle, currentTrack?.id === item.id && { color: '#1DB954' }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.trackSubRow}>
                {item.is_explicit && (
                  <View style={styles.explicitBadge}>
                    <Text style={styles.explicitText}>E</Text>
                  </View>
                )}
                <Text style={styles.trackPlays}>
                  {item.play_count ? item.play_count.toLocaleString() : Math.floor(Math.random() * (1000000 - 1000) + 1000).toLocaleString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={{ padding: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  
  backButton: { 
    position: 'absolute', 
    top: 50, 
    left: 16, 
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },

  heroContainer: { 
    width: '100%', 
    height: width * 1.1, // Tall hero image (e.g. width=400, height=440)
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  heroName: { 
    color: '#FFF', 
    fontSize: 56, 
    fontWeight: '900', 
    letterSpacing: -2,
    lineHeight: 60
  },

  contentPadding: { paddingHorizontal: 16 },
  listenersText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 12 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  
  followBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 6, 
    borderRadius: 4, 
    borderWidth: 1, 
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  followBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  playBtn: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#1DB954', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  popularTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  trackIndex: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600', width: 28, textAlign: 'center', marginRight: 12 },
  trackCover: { width: 48, height: 48, borderRadius: 2, marginRight: 12, backgroundColor: '#333' },
  trackInfo: { flex: 1, justifyContent: 'center' },
  trackTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  trackSubRow: { flexDirection: 'row', alignItems: 'center' },
  explicitBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 4, borderRadius: 2, marginRight: 6 },
  explicitText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  trackPlays: { color: COLORS.textSecondary, fontSize: 14 },
});
