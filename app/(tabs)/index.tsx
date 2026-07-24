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
  { id: 1, title: 'Late Night Drive', gradient: ['#141E30', '#243B55'] },
  { id: 2, title: 'Gym Motivation', gradient: ['#FF416C', '#FF4B2B'] },
  { id: 3, title: 'Chill Sunday', gradient: ['#4CB8C4', '#3CD3AD'] },
  { id: 4, title: 'Heartbreak', gradient: ['#0f0c29', '#302b63'] },
  { id: 5, title: 'Morning Coffee', gradient: ['#FFB75E', '#ED8F03'] },
  { id: 6, title: 'Party Mode', gradient: ['#8E2DE2', '#4A00E0'] },
];



const FALLBACK_PAINTINGS = [
  require('../../assets/images/african_art_1.jpg'),
  require('../../assets/images/african_art_2.jpg'),
  require('../../assets/images/african_art_3.png'),
  require('../../assets/images/african_art_4.jpg'),
  require('../../assets/images/african_art_5.png')
];

const getFallbackImage = (idStr?: string) => {
  if (!idStr) return FALLBACK_PAINTINGS[0];
  const sum = String(idStr).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_PAINTINGS[sum % FALLBACK_PAINTINGS.length];
};

// STATIONS removed in favor of dynamic liveStations

const { width, height } = Dimensions.get('window');
const ITEM_SIZE = width * 0.72;
const SPACER_ITEM_SIZE = (width - ITEM_SIZE) / 2;

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
  const [aiTracks, setAiTracks] = useState<Track[]>([]);
  const [liveStations, setLiveStations] = useState<any[]>([]);
  const [emergingArtists, setEmergingArtists] = useState<Profile[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [autoPlaylists, setAutoPlaylists] = useState<{ id: string, title: string, subtitle: string, colors: string[], tracks: Track[] }[]>([]);
  
  // New Categories
  const [weekendParty, setWeekendParty] = useState<Track[]>([]);
  const [midnightSoul, setMidnightSoul] = useState<Track[]>([]);
  const [underRadar, setUnderRadar] = useState<Track[]>([]);

  // Animation for sticky header & ticker
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const heroCarouselRef = useRef<any>(null);
  const currentHeroIndex = useRef(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  useEffect(() => {
    loadTrending();
  }, [selectedRegion]);

  const loadTrending = async () => {
    let query = supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey!inner(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('play_count', { ascending: false }).limit(20);
    
    if (selectedRegion !== 'All') {
      query = query.ilike('profile.location', `%${selectedRegion}%`);
    }
    
    const { data, error } = await query;
    if (error) console.error("Trending Error:", error);
    if (data) setTrending(data as Track[]);
  };

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [featuredRes, newRes, artistsRes, albumsRes, myPlaylistsRes, classicsRes, emergingRes, eventsRes, aiRes, liveRes] = await Promise.all([
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('play_count', { ascending: false }).limit(7), // Increased limit for jump back in
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('created_at', { ascending: false }).limit(10),
        supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: false }).limit(10),
        supabase.from('playlists').select('id, title, cover_url, track_count').eq('is_public', true).gt('track_count', 0).order('track_count', { ascending: false }).limit(10),
        session?.user.id ? supabase.from('playlists').select('*').eq('user_id', session.user.id).gt('track_count', 0).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: null }),
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('created_at', { ascending: true }).limit(10),
        supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: true }).limit(10),
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).eq('is_ai', true).order('play_count', { ascending: false }).limit(10),
        supabase.from('live_stations').select('*, profiles(display_name, username, avatar_url)').eq('status', 'live').order('listener_count', { ascending: false }).limit(10)
      ]);
      
      await loadTrending(); 
      
      if (featuredRes.data) setFeatured(featuredRes.data as Track[]);
      if (newRes.data) setNewReleases(newRes.data as Track[]);
      if (artistsRes.data) setArtists((artistsRes.data as Profile[]).sort(() => Math.random() - 0.5));
      if (albumsRes.data) setAlbums(albumsRes.data as Playlist[]);
      if (myPlaylistsRes.data) setMyPlaylists(myPlaylistsRes.data as Playlist[]);
      if (classicsRes.data) setClassics(classicsRes.data as Track[]);
      if (aiRes.data) setAiTracks(aiRes.data as Track[]);
      if (emergingRes.data) setEmergingArtists((emergingRes.data as Profile[]).sort(() => Math.random() - 0.5));
      if (eventsRes.data) setEvents(eventsRes.data);
      if (liveRes.data) setLiveStations(liveRes.data);

      if (session?.user.id) {
        // Fetch recently played
        const { data: recentHistory } = await supabase.from('listening_history')
          .select('track_id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(30);
          
        if (recentHistory && recentHistory.length > 0) {
          const trackIds = [...new Set(recentHistory.map(r => r.track_id))].slice(0, 10);
          const { data: tracksData } = await supabase.from('tracks')
            .select('*, profile:profiles!tracks_user_id_fkey(*)')
            .in('id', trackIds);
            
          if (tracksData) {
            const sortedTracks = trackIds.map(id => tracksData.find(t => t.id === id)).filter(Boolean) as Track[];
            setRecentlyPlayed(sortedTracks);
          }
        } else {
          // Fallback: If no history, just show some tracks to keep the UI looking full
          const { data: randomTracks } = await supabase.from('tracks')
            .select('*, profile:profiles!tracks_user_id_fkey(*)')
            .eq('is_public', true)
            .limit(10);
          if (randomTracks) {
            setRecentlyPlayed(randomTracks.sort(() => 0.5 - Math.random()) as Track[]);
          }
        }
      }

      // Generate Auto Playlists based on random genres
      const shuffledGenres = [...GENRES].sort(() => 0.5 - Math.random()).slice(0, 3);
      const generatedPlaylists = [];
      const gradients = [
        ['#ff4b1f', '#ff9068'],
        ['#2193b0', '#6dd5ed'],
        ['#8E2DE2', '#4A00E0'],
        ['#FF416C', '#FF4B2B'],
        ['#0f0c29', '#302b63']
      ];
      
      for (let i = 0; i < shuffledGenres.length; i++) {
        const genre = shuffledGenres[i];
        let { data: genreTracks } = await supabase.from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('genre', genre.name)
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(20);
          
        // Fallback: If no tracks for this genre in DB, grab random tracks so the playlist still generates
        if (!genreTracks || genreTracks.length === 0) {
          const { data: randomTracks } = await supabase.from('tracks')
            .select('*, profile:profiles!tracks_user_id_fkey(*)')
            .eq('is_public', true)
            .limit(20);
          genreTracks = randomTracks?.sort(() => 0.5 - Math.random()) || null;
        }
          
        if (genreTracks && genreTracks.length > 0) {
          generatedPlaylists.push({
            id: `auto_${genre.name}`,
            title: `${genre.name} Mix`,
            subtitle: 'Made for you',
            colors: gradients[i % gradients.length],
            tracks: genreTracks as Track[]
          });
        }
      }
      setAutoPlaylists(generatedPlaylists);

      // Fetch New Categories (with distinct fallbacks to prevent duplicates)
      const { data: genericFallback } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).limit(50);
      const fallbackTracks = genericFallback ? genericFallback.sort(() => 0.5 - Math.random()) : [];

      // 1. Weekend Party Starters (Amapiano, Singeli, Bongo Flava)
      const { data: weekendData } = await supabase.from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .in('genre', ['Amapiano', 'Singeli', 'Bongo Flava'])
        .eq('is_public', true)
        .order('play_count', { ascending: false })
        .limit(10);
      setWeekendParty((weekendData?.length ? weekendData : fallbackTracks.slice(0, 10)) as Track[]);

      // 2. Midnight Soul (R&B, Emotion, Taarab)
      const { data: midnightData } = await supabase.from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .in('genre', ['R&B', 'Emotion', 'Taarab'])
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);
      setMidnightSoul((midnightData?.length ? midnightData : fallbackTracks.slice(10, 20)) as Track[]);

      // 3. Under the Radar (Lowest play counts)
      const { data: radarData } = await supabase.from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('is_public', true)
        .order('play_count', { ascending: true })
        .limit(15);
      setUnderRadar((radarData?.length ? radarData : fallbackTracks.slice(20, 30)) as Track[]);

    } catch (e) {
      console.log("Offline or network error fetching home data", e);
    } finally {
      setLoading(false);
    }
  };

  const generateRoadTripPlaylist = async () => {
    try {
      const { data } = await supabase
        .from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('is_public', true)
        .order('play_count', { ascending: false })
        .limit(50);
        
      if (data && data.length > 0) {
        const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 20);
        playTrack(shuffled[0], shuffled);
        router.push('/player');
      }
    } catch (e) {
      console.error("Failed to generate road trip playlist", e);
    }
  };

  useEffect(() => {
    if (trending.length === 0) return;
    const interval = setInterval(() => {
      currentHeroIndex.current = (currentHeroIndex.current + 1) % Math.min(trending.length, 10);
      heroCarouselRef.current?.scrollTo({ x: currentHeroIndex.current * width, animated: true });
    }, 4000);
    return () => clearInterval(interval);
  }, [trending]);

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

  const playVibe = (vibeTitle: string) => {
    // Collect tracks to simulate AI playlist generation
    const allTracks = [...trending, ...featured, ...classics, ...newReleases];
    if (allTracks.length === 0) return;
    
    // Remove duplicates
    const uniqueTracks = Array.from(new Map(allTracks.map(item => [item.id, item])).values());
    
    // Shuffle them to simulate a dynamic, fresh playlist
    const shuffled = uniqueTracks.sort(() => 0.5 - Math.random());
    
    // Take the top 20
    const playlist = shuffled.slice(0, 20);
    
    // Immediately play the vibe playlist
    if (playlist.length > 0) {
      playTrack(playlist[0], playlist);
      router.push('/player');
    }
  };

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

        {/* Massive Hero Banner Carousel */}
        {top10Tracks.length > 0 && (
          <ScrollView 
            ref={heroCarouselRef}
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            style={{ width: '100%', height: height * 0.55, position: 'relative' }}
          >
            {top10Tracks.map((track, index) => (
              <View key={track.id} style={{ width, height: height * 0.55, justifyContent: 'flex-end', position: 'relative' }}>
                <Image 
                  source={{ uri: track.cover_url || undefined }} 
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
                    <Text style={styles.heroBadgeText}>#{index + 1} TRENDING</Text>
                  </View>
                  
                  <Text style={styles.heroTitle} numberOfLines={2}>{track.title}</Text>
                  <Text style={styles.heroArtist} numberOfLines={1}>{track.artist_name}</Text>
                  
                  <View style={styles.heroActions}>
                    <TouchableOpacity 
                      style={styles.heroPlayBtn}
                      onPress={() => playTrack(track, top10Tracks)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={currentTrack?.id === track.id && isPlaying ? "pause" : "play"} size={28} color={COLORS.black} style={{ marginLeft: currentTrack?.id === track.id && isPlaying ? 0 : 4 }} />
                      <Text style={styles.heroPlayText}>{currentTrack?.id === track.id && isPlaying ? "PAUSE" : "PLAY"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.heroSaveBtn}>
                      <Ionicons name="add" size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Smart Vibe Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, marginTop: 24, marginBottom: 8 }}>
          {MOODS.map(mood => (
            <TouchableOpacity 
              key={mood.id} 
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 4 }} 
              onPress={() => playVibe(mood.title)}
            >
              <LinearGradient colors={mood.gradient} style={StyleSheet.absoluteFillObject} start={{x: 0, y: 0}} end={{x: 1, y: 1}} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={14} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{mood.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom Bongo Streaming Promo Banner */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
          <TouchableOpacity 
            style={{ width: '100%', height: 220, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            activeOpacity={0.9}
            onPress={() => playVibe('Bongo Streaming Vol. 1')}
          >
            <Image 
              source={require('../../assets/images/splash_image.png')} 
              style={{ width: '100%', height: '100%' }} 
              contentFit="cover"
              transition={300}
            />
            <LinearGradient 
              colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} 
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFillObject} 
            />
            <View style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
              <View style={{ backgroundColor: COLORS.gold, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 }}>
                <Text style={{ color: COLORS.black, fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>
                  ORIGINAL MIX
                </Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>
                Bongo Streaming Vol. 1
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, fontWeight: '500' }}>
                Curated vibes, strictly for the culture.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <View style={[styles.section, { marginTop: 0 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Played</Text>
              <Ionicons name="time-outline" size={20} color={COLORS.gold} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {recentlyPlayed.map(track => (
                <TouchableOpacity
                  key={`recent-${track.id}`}
                  style={styles.hTrackCard}
                  activeOpacity={0.8}
                  onPress={() => playTrack(track, recentlyPlayed)}
                >
                  <Image
                    source={{ uri: track.cover_url || undefined }}
                    style={styles.hTrackImage}
                    transition={200} cachePolicy="memory-disk"
                  />
                  {currentTrack?.id === track.id && isPlaying && (
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

        {/* Dynamic Auto Playlists (Made For You) */}
        {autoPlaylists.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Made For You</Text>
              <Ionicons name="color-palette" size={20} color={COLORS.gold} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {autoPlaylists.map((mix) => (
                <TouchableOpacity 
                  key={mix.id} 
                  style={{ width: 160, marginRight: 16, borderRadius: 12, overflow: 'hidden' }}
                  onPress={() => {
                    playTrack(mix.tracks[0], mix.tracks);
                    router.push('/player');
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={mix.colors} style={{ width: 160, height: 160, padding: 12, justifyContent: 'space-between' }}>
                    <Ionicons name="musical-notes" size={24} color="#FFF" />
                    <View>
                      <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{mix.title}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>{mix.subtitle}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI Generated Hits */}
        {aiTracks.length > 0 && (
          <View style={[styles.section, { marginTop: 24 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI Generated Hits</Text>
              <Ionicons name="sparkles" size={20} color="#00FFCC" style={{ marginLeft: 6 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {aiTracks.map((track) => (
                <TouchableOpacity 
                  key={track.id} 
                  style={{ width: 140, marginRight: 16 }}
                  onPress={() => playTrack(track, aiTracks)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: track.cover_url || undefined }} style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: COLORS.cardAlt }} />
                  <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#00FFCC' }}>
                    <Text style={{ color: '#00FFCC', fontSize: 10, fontWeight: 'bold' }}>AI</Text>
                  </View>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{track.title}</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{track.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 2. Live in Studio / Radio Sessions */}
        {liveStations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live in Studio</Text>
              <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {liveStations.map((station) => (
                <TouchableOpacity 
                  key={station.id} 
                  style={styles.stationCard} 
                  activeOpacity={0.8}
                  onPress={() => router.push(`/station/${station.id}`)}
                >
                  <Image source={{ uri: station.cover_url || station.profiles?.avatar_url || undefined }} style={styles.stationImage} />
                  <View style={styles.stationOverlay}>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                    <View style={styles.viewerBadge}>
                      <Ionicons name="eye" size={10} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.viewerText}>{station.listener_count || 0}</Text>
                    </View>
                  </View>
                  <Text style={styles.stationName} numberOfLines={1}>{station.title || station.profiles?.display_name || 'Live Station'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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

        {/* Road Trip Playlist Generator - Custom Image Design */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
          <View 
            style={{
              backgroundColor: '#2A1B23', // Dark maroon/purple tint matching image
              borderRadius: 24,
              padding: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            {/* Left Texts */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>Road Trip Mode</Text>
              <Text style={{ color: '#D4B8C1', fontSize: 16, marginTop: 4, fontWeight: '500' }}>Sync music with friends</Text>
            </View>

            {/* Right Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Scan Box */}
              <TouchableOpacity style={{ backgroundColor: '#1A0F14', padding: 12, borderRadius: 12, marginRight: 12 }}>
                <Ionicons name="scan" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              
              {/* Start Button */}
              <TouchableOpacity 
                onPress={() => router.push('/jam-session')}
                style={{ backgroundColor: '#FF3565', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14 }}
              >
                <Text style={{ color: '#000000', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>START</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 4. 3D Cover Flow Carousel for Charts */}
        {top10Tracks.length > 0 && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tanzania Top 10 🇹🇿</Text>
            </View>
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_SIZE}
              decelerationRate="fast"
              bounces={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
              contentContainerStyle={{ alignItems: 'center', paddingHorizontal: SPACER_ITEM_SIZE }}
            >
              {top10Tracks.map((track, index) => {
                const inputRange = [
                  (index - 1) * ITEM_SIZE,
                  index * ITEM_SIZE,
                  (index + 1) * ITEM_SIZE,
                ];

                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.8, 1, 0.8],
                  extrapolate: 'clamp',
                });

                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.5, 1, 0.5],
                  extrapolate: 'clamp',
                });

                return (
                  <Animated.View key={track.id} style={{ width: ITEM_SIZE, transform: [{ scale }], opacity }}>
                    <TouchableOpacity 
                      style={styles.carouselCard}
                      onPress={() => playTrack(track, top10Tracks)}
                      activeOpacity={0.9}
                    >
                      <Image 
                        source={{ uri: track.cover_url || undefined }} 
                        style={styles.carouselImage} 
                        transition={200} cachePolicy="memory-disk"
                      />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.carouselGradient} />
                      <View style={styles.carouselRank}>
                        <Text style={styles.carouselRankText}>#{index + 1}</Text>
                      </View>
                      <View style={styles.carouselInfo}>
                        <Text style={styles.carouselTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.carouselArtist} numberOfLines={1}>{track.artist_name}</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
          </View>
        )}

        {/* 3. Today in Bongo History */}
        {classics.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historyCard}>
              <LinearGradient colors={['#FF0099', '#493240']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFillObject} />
              <View style={styles.historyOverlay}>
                <View style={styles.historyHeader}>
                  <Ionicons name="calendar" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.historyDateText}>Today in Bongo History</Text>
                </View>
                <View style={styles.historyContent}>
                  <Image source={{ uri: classics[0].cover_url || undefined }} style={styles.historyImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTrackTitle} numberOfLines={2}>{classics[0].title}</Text>
                    <Text style={styles.historyTrackArtist} numberOfLines={1}>{classics[0].artist_name}</Text>
                    <TouchableOpacity 
                      style={styles.historyPlayBtn}
                      onPress={() => playTrack(classics[0], classics)}
                    >
                      <Ionicons name="play" size={14} color={COLORS.black} />
                      <Text style={styles.historyPlayText}>PLAY CLASSIC</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
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
                  <Image source={playlist.cover_url ? { uri: playlist.cover_url } : getFallbackImage(playlist.id)} style={styles.albumImage} transition={200} cachePolicy="memory-disk" />
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

        {/* Wall of Fame Banner */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
          <TouchableOpacity 
            style={{ width: '100%', height: 160, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            activeOpacity={0.9}
            onPress={() => router.push('/know-your-artist')}
          >
            <LinearGradient 
              colors={[COLORS.goldDark, COLORS.gold, COLORS.goldLight]} 
              start={{x: 0, y: 0}} end={{x: 1, y: 1}}
              style={StyleSheet.absoluteFillObject} 
            />
            <View style={{ position: 'absolute', top: -30, right: -20, opacity: 0.2 }}>
              <Ionicons name="star" size={150} color={COLORS.black} />
            </View>
            <View style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
              <View style={{ backgroundColor: COLORS.black, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 }}>
                <Text style={{ color: COLORS.gold, fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>
                  WALL OF FAME
                </Text>
              </View>
              <Text style={{ color: COLORS.black, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
                Know Your Artist
              </Text>
              <Text style={{ color: 'rgba(0,0,0,0.8)', fontSize: 14, marginTop: 4, fontWeight: '700' }}>
                Discover the legends and rising stars of Bongo Flava.
              </Text>
            </View>
          </TouchableOpacity>
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
                    <View style={[styles.artistImage, { backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 32, fontWeight: 'bold' }}>{artist.display_name?.charAt(0)?.toUpperCase() || '?'}</Text>
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
                  {artist.avatar_url ? (
                    <Image source={{ uri: artist.avatar_url }} style={styles.emergingImage} />
                  ) : (
                    <View style={[styles.emergingImage, { backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 32, fontWeight: 'bold' }}>{artist.display_name?.charAt(0)?.toUpperCase() || '?'}</Text>
                    </View>
                  )}
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
                  <Image source={album.cover_url ? { uri: album.cover_url } : getFallbackImage(album.id)} style={styles.albumImage} transition={200} cachePolicy="memory-disk" />
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

        {/* Weekend Party Starters */}
        {weekendParty.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Weekend Party Starters</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {weekendParty.map(track => (
                <TrackCard key={`weekend-${track.id}`} track={track} tracks={weekendParty} playTrack={playTrack} currentTrack={currentTrack} isPlaying={isPlaying} styles={styles} COLORS={COLORS} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Midnight Soul */}
        {midnightSoul.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Midnight Soul</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {midnightSoul.map(track => (
                <TrackCard key={`midnight-${track.id}`} track={track} tracks={midnightSoul} playTrack={playTrack} currentTrack={currentTrack} isPlaying={isPlaying} styles={styles} COLORS={COLORS} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Under The Radar */}
        {underRadar.length > 0 && (
          <View style={[styles.section, { marginBottom: 40 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Under The Radar</Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Hidden gems you need to hear</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {underRadar.map(track => (
                <TrackCard key={`radar-${track.id}`} track={track} tracks={underRadar} playTrack={playTrack} currentTrack={currentTrack} isPlaying={isPlaying} styles={styles} COLORS={COLORS} />
              ))}
            </ScrollView>
          </View>
        )}

      </Animated.ScrollView>
    </View>
  );
}

// Helper component for standard horizontal track cards
function TrackCard({ track, tracks, playTrack, currentTrack, isPlaying, styles, COLORS }: any) {
  return (
    <TouchableOpacity
      style={styles.hTrackCard}
      activeOpacity={0.8}
      onPress={() => playTrack(track, tracks)}
    >
      <Image
        source={{ uri: track.cover_url || undefined }}
        style={styles.hTrackImage}
        transition={200} cachePolicy="memory-disk"
      />
      {currentTrack?.id === track.id && isPlaying && (
        <View style={styles.hTrackPlayingOverlay}>
          <Ionicons name="stats-chart" size={24} color={COLORS.gold} />
        </View>
      )}
      <Text style={styles.hTrackTitle} numberOfLines={1}>{track.title}</Text>
      <Text style={styles.hTrackArtist} numberOfLines={1}>{track.artist_name}</Text>
    </TouchableOpacity>
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
  
  // Floating Jam Button
  floatingJamBtn: { position: 'absolute', bottom: 100, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, zIndex: 100 },

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

  // Daily Mixes
  mixCard: { width: 280, height: 160, borderRadius: 16, overflow: 'hidden', padding: 20 },
  mixCollage: { position: 'absolute', top: -10, right: -20, width: 140, height: 140 },
  mixImage: { position: 'absolute', width: 70, height: 70, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  mixImage1: { top: 30, right: 20, zIndex: 3, transform: [{ rotate: '10deg' }] },
  mixImage2: { top: 10, right: 60, zIndex: 2, transform: [{ rotate: '-5deg' }] },
  mixImage3: { top: 60, right: 50, zIndex: 1, transform: [{ rotate: '-15deg' }] },
  mixContent: { flex: 1, justifyContent: 'flex-end', zIndex: 10 },
  mixTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  mixSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },

  // Live in Studio
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginLeft: 8 },
  stationCard: { width: 140 },
  stationImage: { width: 140, height: 140, borderRadius: 16, backgroundColor: COLORS.card },
  stationOverlay: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
  liveBadge: { backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  viewerBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center' },
  viewerText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  stationName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 8 },

  // 3D Carousel
  carouselCard: { width: '100%', height: ITEM_SIZE, borderRadius: 24, overflow: 'hidden', backgroundColor: COLORS.card },
  carouselImage: { width: '100%', height: '100%' },
  carouselGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  carouselRank: { position: 'absolute', top: 16, left: 16, backgroundColor: COLORS.gold, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  carouselRankText: { color: COLORS.black, fontSize: 14, fontWeight: '900' },
  carouselInfo: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  carouselTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  carouselArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600' },

  // Today in History
  historyCard: { marginHorizontal: 16, height: 140, borderRadius: 16, overflow: 'hidden' },
  historyOverlay: { flex: 1, padding: 16, justifyContent: 'space-between' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  historyDateText: { color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  historyContent: { flexDirection: 'row', alignItems: 'center' },
  historyImage: { width: 70, height: 70, borderRadius: 8, marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  historyTrackTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 2 },
  historyTrackArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 8 },
  historyPlayBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  historyPlayText: { color: COLORS.black, fontSize: 10, fontWeight: '900', marginLeft: 4 },

  roadTripCard: { height: 120, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  roadTripOverlay: { flex: 1, padding: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  roadTripIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212, 175, 55, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  roadTripTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 },
  roadTripSub: { color: COLORS.textTertiary, fontSize: 13, fontWeight: '500' },
  roadTripBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});
