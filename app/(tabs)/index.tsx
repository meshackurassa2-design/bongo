import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Animated, Platform
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { GENRES, Track, Profile, Playlist } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import TrackItem from '../../components/TrackItem';

const REGIONS = ['All', 'Kinondoni', 'Ilala', 'Temeke', 'Mwanza', 'Arusha', 'Dodoma'];

const MOODS = [
  { id: 1, title: 'Morning Motivation', subtitle: 'Start your day right', image: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=500&q=80', gradient: ['#FFB75E', '#ED8F03'] },
  { id: 2, title: 'Commute Vibes', subtitle: 'Traffic jams made easy', image: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=500&q=80', gradient: ['#4CB8C4', '#3CD3AD'] },
  { id: 3, title: 'Late Night Chill', subtitle: 'Unwind and relax', image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=500&q=80', gradient: ['#141E30', '#243B55'] },
];

const { width, height } = Dimensions.get('window');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', icon: 'partly-sunny' as const };
  if (hour < 18) return { text: 'Good Afternoon', icon: 'partly-sunny-outline' as const };
  return { text: 'Good Evening', icon: 'moon' as const };
};

export default function HomeScreen() {
  const { COLORS, theme } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { t } = useTranslation();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const session = useAuthStore(s => s.session);

  const [featured, setFeatured] = useState<Track[]>([]);
  const [trending, setTrending] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Profile[]>([]);
  const [albums, setAlbums] = useState<Playlist[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [classics, setClassics] = useState<Track[]>([]);
  const [emergingArtists, setEmergingArtists] = useState<Profile[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('All');

  // Animation for sticky header & ticker
  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadTrending();
  }, [selectedRegion]);

  const loadTrending = async () => {
    let query = supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey!inner(*)').eq('is_public', true).order('play_count', { ascending: false }).limit(20);
    
    if (selectedRegion !== 'All') {
      query = query.ilike('profile.location', `%${selectedRegion}%`);
    }
    
    const { data, error } = await query;
    if (error) console.error("Trending Error:", error);
    if (data) setTrending(data as Track[]);
  };

  const loadData = async () => {
    setLoading(true);
    const [featuredRes, newRes, artistsRes, albumsRes, myPlaylistsRes, classicsRes, emergingRes, eventsRes] = await Promise.all([
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).order('play_count', { ascending: false }).limit(7), // Increased limit for jump back in
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).order('created_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: false }).limit(10),
      supabase.from('playlists').select('id, title, cover_url, track_count').eq('is_public', true).gt('track_count', 0).order('track_count', { ascending: false }).limit(10),
      session?.user.id ? supabase.from('playlists').select('*').eq('user_id', session.user.id).gt('track_count', 0).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: null }),
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).order('created_at', { ascending: true }).limit(10),
      supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: true }).limit(10),
      supabase.from('events').select('*').order('event_date', { ascending: true })
    ]);
    
    await loadTrending(); 
    
    if (featuredRes.data) setFeatured(featuredRes.data as Track[]);
    if (newRes.data) setNewReleases(newRes.data as Track[]);
    if (artistsRes.data) setArtists(artistsRes.data as Profile[]);
    if (albumsRes.data) setAlbums(albumsRes.data as Playlist[]);
    if (myPlaylistsRes.data) setMyPlaylists(myPlaylistsRes.data as Playlist[]);
    if (classicsRes.data) setClassics(classicsRes.data as Track[]);
    if (emergingRes.data) setEmergingArtists(emergingRes.data as Profile[]);
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  };


  const createPlaylist = async () => {
    if (!session) {
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

  const heroTrack = featured[0];
  const jumpBackTracks = featured.slice(1, 7);
  const top10Tracks = trending.slice(0, 10);
  const recommendedTracks = [...trending].reverse().slice(0, 6);
  const recommendedArtist = heroTrack?.artist_name || 'Diamond Platnumz';

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Sticky Blur Header */}
      <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
        <BlurView intensity={theme === 'luxury' || theme === 'cyberpunk' ? 80 : 30} tint={theme === 'luxury' ? 'dark' : 'default'} style={StyleSheet.absoluteFillObject} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{getGreeting().text} </Text>
          <Ionicons name={getGreeting().icon} size={20} color={COLORS.textPrimary} />
        </View>
      </Animated.View>

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 160 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >



        {/* Massive Hero Banner */}
        {heroTrack && (
          <View style={styles.heroContainer}>
            <Image 
              source={{ uri: heroTrack.cover_url || undefined }} 
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient 
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', COLORS.black]} 
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFillObject} 
            />
            
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Ionicons name="flame" size={14} color="#FF3B30" />
                <Text style={styles.heroBadgeText}>#1 TRENDING</Text>
              </View>
              
              <Text style={styles.heroTitle} numberOfLines={2}>{heroTrack.title}</Text>
              <Text style={styles.heroArtist} numberOfLines={1}>{heroTrack.artist_name}</Text>
              
              <View style={styles.heroActions}>
                <TouchableOpacity 
                  style={styles.heroPlayBtn}
                  onPress={() => playTrack(heroTrack, [heroTrack, ...top10Tracks])}
                  activeOpacity={0.8}
                >
                  <Ionicons name={currentTrack?.id === heroTrack.id && isPlaying ? "pause" : "play"} size={28} color={COLORS.black} style={{ marginLeft: currentTrack?.id === heroTrack.id && isPlaying ? 0 : 4 }} />
                  <Text style={styles.heroPlayText}>{currentTrack?.id === heroTrack.id && isPlaying ? "PAUSE" : "PLAY"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroSaveBtn}>
                  <Ionicons name="add" size={28} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Jump Back In (Grid of 6) */}
        {jumpBackTracks.length > 0 && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Jump Back In</Text>
            <View style={styles.jumpGrid}>
              {jumpBackTracks.map((track) => (
                <TouchableOpacity 
                  key={track.id} 
                  style={styles.jumpCard}
                  onPress={() => playTrack(track, jumpBackTracks)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: track.cover_url || undefined }} style={styles.jumpImage} />
                  <Text style={styles.jumpTitle} numberOfLines={2}>{track.title}</Text>
                  {currentTrack?.id === track.id && (
                    <View style={styles.jumpPlaying}>
                      <Ionicons name="volume-medium" size={16} color={COLORS.gold} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Road Trip Section */}
        <View style={[styles.roadTripContainer, { marginBottom: 24 }]}>
          <LinearGradient colors={[COLORS.card, COLORS.cardAlt]} style={styles.roadTripGradient}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>Road Trip Mode</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>Sync music with friends</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.rtBtn} onPress={() => router.push('/roadtrip/join')}>
                <Ionicons name="scan" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rtBtn, { backgroundColor: COLORS.gold }]} onPress={() => router.push('/roadtrip/host')}>
                <Text style={{ color: COLORS.black, fontWeight: '800', fontSize: 14 }}>START</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Billboard Top 10 Charts */}
        {top10Tracks.length > 0 && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <Text style={styles.sectionTitle}>Tanzania Top 10 🇹🇿</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {top10Tracks.map((track, index) => (
                <TouchableOpacity 
                  key={track.id} 
                  style={styles.hTrackCard}
                  onPress={() => playTrack(track, top10Tracks)}
                  activeOpacity={0.8}
                >
                  <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 1, borderColor: COLORS.gold }}>
                     <Text style={{ color: COLORS.gold, fontWeight: '900', fontSize: 12 }}>{index + 1}</Text>
                  </View>
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
                  <Text style={[styles.hTrackTitle, currentTrack?.id === track.id && { color: COLORS.gold }]} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.hTrackArtist} numberOfLines={1}>{track.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* --- BEGIN ORIGINAL SECTIONS --- */}

        {/* Sleek Genres (Pills) */}
        <View style={[styles.sectionHeader, { marginTop: 30 }]}>
          <Text style={styles.sectionTitle}>{t('home.genres')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genrePills}>
          {GENRES.map(g => (
            <TouchableOpacity
              key={g.name}
              style={styles.genrePill}
              onPress={() => router.push({ pathname: '/genre/[name]', params: { name: g.name } })}
              activeOpacity={0.8}
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
          <View style={[styles.sectionHeader, { gap: 6 }]}>
            <Text style={styles.sectionTitle}>Mtaa Leaderboards</Text>
            <Ionicons name="trophy" size={20} color={COLORS.gold} />
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

        {/* 3. Artists to Watch */}
        {emergingArtists.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { gap: 6 }]}>
              <Text style={styles.sectionTitle}>Artists to Watch</Text>
              <Ionicons name="star" size={20} color={COLORS.gold} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {emergingArtists.map(artist => (
                <View key={artist.id} style={styles.emergingCard}>
                  <Image source={{ uri: artist.avatar_url || undefined }} style={styles.emergingImage} />
                  <Text style={styles.emergingName} numberOfLines={1}>{artist.display_name}</Text>
                  <Text style={styles.emergingFollowers}>{artist.follower_count} fans</Text>
                  <TouchableOpacity 
                    style={styles.followBtn}
                    onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
                  >
                    <Text style={styles.followBtnText}>Follow</Text>
                  </TouchableOpacity>
                </View>
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

        {/* 5. Because You Listen To... (AI Recommendations) */}
        {recommendedTracks.length > 0 && session && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>Recommended For You</Text>
                <Text style={styles.sectionTitle}>Because you listen to {recommendedArtist}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {recommendedTracks.map(track => (
                <TouchableOpacity
                  key={`rec-${track.id}`}
                  style={styles.hTrackCard}
                  activeOpacity={0.8}
                  onPress={() => playTrack(track, recommendedTracks)}
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
          </View>
        )}

        {/* 4. Bongo Classics */}
        {classics.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { gap: 6 }]}>
              <Text style={styles.sectionTitle}>Bongo Classics</Text>
              <Ionicons name="time" size={20} color={COLORS.gold} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {classics.map(track => (
                <TouchableOpacity
                  key={track.id}
                  style={styles.classicCard}
                  activeOpacity={0.8}
                  onPress={() => playTrack(track, classics)}
                >
                  <Image source={{ uri: track.cover_url || undefined }} style={styles.classicImage} />
                  <View style={styles.classicInfo}>
                    <Text style={styles.classicTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.classicArtist} numberOfLines={1}>{track.artist_name}</Text>
                  </View>
                  <Ionicons name="play-circle" size={32} color={COLORS.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 6. Local Concerts & Events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { gap: 6 }]}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <Ionicons name="ticket" size={20} color={COLORS.gold} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {events.map(event => (
                <TouchableOpacity 
                  key={event.id} 
                  style={styles.eventCard} 
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
                >
                  <Image source={{ uri: event.image_url }} style={styles.eventImage} />
                  <View style={styles.eventDateBadge}>
                    <Text style={styles.eventDateMonth}>{new Date(event.event_date).toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                    <Text style={styles.eventDateDay}>{new Date(event.event_date).getDate()}</Text>
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventLocation}><Ionicons name="location" size={12} /> {event.location}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {trending.length === 0 && newReleases.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="musical-notes" size={64} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Hakuna Nyimbo Bado</Text>
            <Text style={styles.emptyText}>Kuwa wa kwanza kupakia wimbo!</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  
  // Header
  headerContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    zIndex: 100,
    justifyContent: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  
  // Hero
  roadTripContainer: { paddingHorizontal: 16, marginBottom: 16, marginTop: 10 },
  roadTripGradient: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider },
  rtBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  
  heroContainer: { width: '100%', height: height * 0.55, justifyContent: 'flex-end', position: 'relative' },
  heroContent: { paddingHorizontal: 24, paddingBottom: 40, zIndex: 10 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#ffffff', fontSize: 42, fontWeight: '900', lineHeight: 46, marginBottom: 4 },
  heroArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '600', marginBottom: 24 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroPlayBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30, gap: 8 },
  heroPlayText: { color: COLORS.black, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  heroSaveBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  section: { marginTop: 10, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  
  // Jump Grid
  jumpGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  jumpCard: { width: (width - 42) / 2, backgroundColor: COLORS.card, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', height: 56, paddingRight: 8 },
  jumpImage: { width: 56, height: 56 },
  jumpTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', marginLeft: 8 },
  jumpPlaying: { position: 'absolute', right: 8 },

  // Top 5 Chart
  chartList: { paddingHorizontal: 16, gap: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 10, borderRadius: 12 },
  chartRank: { color: COLORS.textSecondary, fontSize: 24, fontWeight: '900', width: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
  chartImage: { width: 60, height: 60, borderRadius: 8 },
  chartInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  chartTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  chartArtist: { color: COLORS.textSecondary, fontSize: 13 },
  
  // Original Styles merged
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
  
  albumCard: { width: 140 },
  albumImage: { width: 140, height: 140, borderRadius: 12, backgroundColor: COLORS.cardAlt, marginBottom: 8 },
  albumTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  albumSubtitle: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  
  createPlaylistCard: { width: 100, marginRight: 8 },
  createPlaylistIcon: { width: 100, height: 100, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
  
  // New Styles
  statsWidget: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  statsContent: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  statsSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  statsAction: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsActionText: { color: COLORS.black, fontWeight: '800', fontSize: 12 },
  
  moodCard: { width: 220, height: 120, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end', padding: 16 },
  moodContent: { zIndex: 10 },
  moodTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  moodSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  
  emergingCard: { width: 130, backgroundColor: COLORS.card, padding: 16, borderRadius: 16, alignItems: 'center' },
  emergingImage: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  emergingName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2, textAlign: 'center' },
  emergingFollowers: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 },
  followBtn: { width: '100%', paddingVertical: 6, backgroundColor: COLORS.gold, borderRadius: 20, alignItems: 'center' },
  followBtnText: { color: COLORS.black, fontSize: 12, fontWeight: '700' },
  
  classicCard: { width: 260, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 12, borderRadius: 16 },
  classicImage: { width: 60, height: 60, borderRadius: 8 },
  classicInfo: { flex: 1, marginHorizontal: 12, justifyContent: 'center' },
  classicTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  classicArtist: { color: COLORS.textSecondary, fontSize: 13 },
  
  eventCard: { width: 240 },
  eventImage: { width: 240, height: 140, borderRadius: 16, marginBottom: 12, backgroundColor: COLORS.card },
  eventDateBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
  eventDateMonth: { color: COLORS.gold, fontSize: 10, fontWeight: '800' },
  eventDateDay: { color: '#fff', fontSize: 16, fontWeight: '900' },
  eventTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  eventLocation: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  
  // New Styles for Cool Upgrades
  aurora1: { position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(138, 35, 135, 0.15)', transform: [{ scale: 1.5 }] },
  aurora2: { position: 'absolute', top: 200, right: -150, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(233, 64, 87, 0.1)', transform: [{ scale: 1.2 }] },
  
  storiesContainer: { marginTop: 100, marginBottom: 20 },
  storyWrap: { alignItems: 'center', width: 64 },
  storyRing: { padding: 3, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  storyImage: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.background },
  storyName: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '600', marginTop: 4 },
  
  tickerContainer: { marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  tickerText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginLeft: 8 },
});
