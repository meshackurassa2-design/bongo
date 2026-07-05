import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, ImageBackground, Dimensions, ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, GENRES, Track, Profile, Playlist } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import TrackItem from '../../components/TrackItem';
import { getGreeting } from '../../utils/helpers';

const REGIONS = ['All', 'Kinondoni', 'Ilala', 'Temeke', 'Mwanza', 'Arusha', 'Dodoma'];

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const session = useAuthStore(s => s.session);

  const [trending, setTrending] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Profile[]>([]);
  const [albums, setAlbums] = useState<Playlist[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('All');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadTrending();
  }, [selectedRegion]);

  const loadTrending = async () => {
    let query = supabase.from('tracks').select('*, profile:profiles!inner(*)').eq('is_public', true).order('play_count', { ascending: false }).limit(10);
    
    if (selectedRegion !== 'All') {
      query = query.ilike('profile.location', `%${selectedRegion}%`);
    }
    
    const { data } = await query;
    if (data) setTrending(data as Track[]);
  };

  const loadData = async () => {
    setLoading(true);
    const [newRes, artistsRes, albumsRes, myPlaylistsRes] = await Promise.all([
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).order('created_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: false }).limit(10),
      supabase.from('playlists').select('id, title, cover_url, track_count').eq('is_public', true).gt('track_count', 0).order('track_count', { ascending: false }).limit(10),
      session?.user.id ? supabase.from('playlists').select('*').eq('user_id', session.user.id).gt('track_count', 0).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: null })
    ]);
    
    await loadTrending(); // loads the trending separately so it can be re-run on region change
    
    if (newRes.data) setNewReleases(newRes.data as Track[]);
    if (artistsRes.data) setArtists(artistsRes.data as Profile[]);
    if (albumsRes.data) setAlbums(albumsRes.data as Playlist[]);
    if (myPlaylistsRes.data) setMyPlaylists(myPlaylistsRes.data as Playlist[]);
    setLoading(false);
  };

  const createPlaylist = async () => {
    if (!session) {
      // @ts-ignore - Alert works on React Native
      import('react-native').then(({ Alert }) => {
        Alert.alert("Login Required", "You must be logged in to create a playlist");
      });
      return;
    }
    import('react-native').then(({ Alert }) => {
      Alert.prompt("New Playlist", "Enter a name for your playlist", [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Create", 
          onPress: async (text) => {
            if (text) {
              const { error } = await supabase.from('playlists').insert({
                title: text,
                user_id: session.user.id,
                is_public: true
              });
              if (error) Alert.alert("Error", error.message);
              else {
                Alert.alert("Success", "Playlist created!");
                loadData();
              }
            }
          } 
        }
      ]);
    });
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
      {/* Header */}
      <LinearGradient colors={[COLORS.gold + '33', 'transparent']} style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.appName}>BONGO STREAM</Text>
      </LinearGradient>

      {/* Featured Carousel */}
      {trending.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            snapToInterval={width - 32 + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          >
            {trending.slice(0, 5).map(track => (
              <TouchableOpacity
                key={`featured-${track.id}`}
                activeOpacity={0.9}
                onPress={() => playTrack(track, trending)}
                style={{ width: width - 32, height: 220, borderRadius: 24, overflow: 'hidden', backgroundColor: COLORS.card }}
              >
                <Image
                  source={{ uri: track.cover_url || undefined }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
                <View style={{ flex: 1, padding: 20, justifyContent: 'flex-end' }}>
                  <Text style={{ color: COLORS.gold, fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Featured</Text>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 26, fontWeight: '900', marginBottom: 4 }} numberOfLines={1}>{track.title}</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 16 }} numberOfLines={1}>{track.artist_name}</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity 
                      style={{ backgroundColor: COLORS.gold, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' }}
                      onPress={() => playTrack(track, trending)}
                    >
                      <Ionicons name={currentTrack?.id === track.id ? "pause" : "play"} size={22} color={COLORS.black} style={{ marginLeft: currentTrack?.id === track.id ? 0 : 3 }} />
                    </TouchableOpacity>
                    <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' }}>
                      {currentTrack?.id === track.id ? "Playing Now" : "Listen Now"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sleek Genres (Pills) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.genres')}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genrePills}>
        {GENRES.map(g => (
          <TouchableOpacity
            key={g.name}
            style={styles.genrePill}
            onPress={() => router.push({ pathname: '/genre/[name]', params: { name: g.name } })}
          >
            <Text style={styles.genrePillText}>{g.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* My Playlists (If logged in) */}
      {session && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Playlists</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {/* Create Playlist Button */}
            <TouchableOpacity style={styles.createPlaylistCard} onPress={createPlaylist}>
              <View style={styles.createPlaylistIcon}>
                <Ionicons name="add" size={32} color={COLORS.gold} />
              </View>
              <Text style={styles.albumTitle}>Create New</Text>
            </TouchableOpacity>
            
            {myPlaylists.map(playlist => (
              <TouchableOpacity key={playlist.id} style={styles.albumCard} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}>
                {playlist.cover_url ? (
                  <Image source={{ uri: playlist.cover_url }} style={styles.albumImage} transition={200} cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.albumImage, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="list" size={40} color={COLORS.textTertiary} />
                  </View>
                )}
                <Text style={styles.albumTitle} numberOfLines={1}>{playlist.title}</Text>
                <Text style={styles.albumSubtitle}>{playlist.track_count || 0} Tracks</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Trending Songs (Mtaa Leaderboards) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mtaa Leaderboards 🏆</Text>
        </View>
        
        {/* Region Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.genrePills, { marginBottom: 16 }]}>
          {REGIONS.map(region => (
            <TouchableOpacity
              key={region}
              style={[styles.genrePill, selectedRegion === region && { backgroundColor: COLORS.gold, borderColor: COLORS.gold }]}
              onPress={() => setSelectedRegion(region)}
            >
              <Text style={[styles.genrePillText, selectedRegion === region && { color: COLORS.black, fontWeight: '800' }]}>
                {region === 'All' ? 'Tanzania (All)' : region}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {trending.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {trending.map(track => (
              <TouchableOpacity
                key={track.id}
                style={styles.hTrackCard}
                activeOpacity={0.8}
                onPress={() => playTrack(track, trending)}
              >
                <Image
                  source={{ uri: track.cover_url || undefined }}
                  style={styles.hTrackImage}
                  transition={200} cachePolicy="memory-disk"
                />
                {currentTrack?.id === track.id && (
                  <View style={styles.hTrackPlayingOverlay}>
                    <Ionicons name="stats-chart" size={24} color={COLORS.gold} />
                  </View>
                )}
                <Text style={styles.hTrackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.hTrackArtist} numberOfLines={1}>{track.artist_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Ionicons name="musical-notes-outline" size={32} color={COLORS.textTertiary} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>No tracks trending in this region yet.</Text>
          </View>
        )}
      </View>

      {/* Bongo Battles Banner */}
      <TouchableOpacity 
        style={styles.battlesBanner}
        onPress={() => router.push('/battles')}
      >
        <LinearGradient colors={['#FF3B30', '#007AFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <View style={styles.battlesBannerContent}>
          <View>
            <Text style={styles.battlesBannerTitle}>BONGO VERZUZ 🥊</Text>
            <Text style={styles.battlesBannerSub}>Vote for your favorite tracks and help artists win cash prizes!</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Trending Artists */}
      {artists.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.trending_artists')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {artists.map(artist => (
              <TouchableOpacity
                key={artist.id}
                style={styles.artistCircle}
                onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
              >
                {artist.avatar_url ? (
                  <Image source={{ uri: artist.avatar_url }} style={styles.artistImage} transition={200} cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.artistImage, { backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person" size={40} color={COLORS.textTertiary} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                  <Text style={[styles.artistName, { marginTop: 0 }]} numberOfLines={1}>{artist.display_name}</Text>
                  {artist.is_verified && <Ionicons name="checkmark-circle" size={12} color={COLORS.gold} style={{ marginLeft: 2 }} />}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Trending Albums / Playlists */}
      {albums.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Albamu Moto</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {albums.map(album => (
              <TouchableOpacity key={album.id} style={styles.albumCard}>
                <Image source={{ uri: album.cover_url || undefined }} style={styles.albumImage} transition={200} cachePolicy="memory-disk" />
                <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
                <Text style={styles.albumSubtitle}>{album.track_count} Nyimbo</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Hot New Releases */}
      {newReleases.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mpya Uliotolewa</Text>
          </View>
          {newReleases.map(track => (
            <TrackItem
              key={track.id}
              track={track}
              isPlaying={currentTrack?.id === track.id}
              onPress={() => playTrack(track, newReleases)}
              onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.user_id } })}
            />
          ))}
        </View>
      )}

      {trending.length === 0 && newReleases.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="musical-notes" size={64} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>Hakuna Nyimbo Bado</Text>
          <Text style={styles.emptyText}>Kuwa wa kwanza kupakia wimbo!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  greeting: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  appName: { color: COLORS.gold, fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  
  section: { marginTop: 10, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  
  genrePills: { paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  genrePill: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.divider },
  genrePillText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  
  hScroll: { paddingHorizontal: 16, gap: 16 },
  
  hTrackCard: { width: 140 },
  hTrackImage: { width: 120, height: 120, borderRadius: 16, marginBottom: 12, backgroundColor: COLORS.card },
  hTrackPlayingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  hTrackTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  hTrackArtist: { color: COLORS.textSecondary, fontSize: 13 },
  
  artistCircle: { width: 100, alignItems: 'center', marginRight: 16 },
  artistImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  artistName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  artistFollowers: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
  
  battlesBanner: { marginHorizontal: 16, marginBottom: 32, borderRadius: 20, overflow: 'hidden' },
  battlesBannerContent: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  battlesBannerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontStyle: 'italic', marginBottom: 4 },
  battlesBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, maxWidth: '90%' },

  albumCard: { width: 140 },
  albumImage: { width: 140, height: 140, borderRadius: 12, backgroundColor: COLORS.cardAlt, marginBottom: 8 },
  albumTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  albumSubtitle: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  
  createPlaylistCard: { width: 100, marginRight: 8 },
  createPlaylistIcon: { width: 100, height: 100, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
});
