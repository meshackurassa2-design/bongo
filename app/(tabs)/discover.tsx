import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track, GENRES } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';

const { width } = Dimensions.get('window');

const PILLS = ['All', 'Spotlight', 'Genres', 'Trending'];

export default function DiscoverScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [activePill, setActivePill] = useState('All');
  const [loading, setLoading] = useState(true);
  const [spotlight, setSpotlight] = useState<Track[]>([]);
  const [trending, setTrending] = useState<Track[]>([]);

  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  useEffect(() => {
    loadDiscoverData();
  }, []);

  const loadDiscoverData = async () => {
    setLoading(true);
    try {
      const [spotlightRes, trendingRes] = await Promise.all([
        supabase
          .from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('is_public', true)
          .order('like_count', { ascending: false })
          .limit(10),
        supabase
          .from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(15)
      ]);
      
      if (spotlightRes.data) setSpotlight(spotlightRes.data as Track[]);
      if (trendingRes.data) setTrending(trendingRes.data as Track[]);
    } catch (e) {
      console.log('Error loading discover:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = (title: string, onShowAll?: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onShowAll && (
        <TouchableOpacity style={styles.viewAllBtn} onPress={onShowAll}>
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
          <TouchableOpacity onPress={() => router.push('/search')} style={styles.searchIcon}>
            <Ionicons name="search" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
          {PILLS.map((pill) => (
            <TouchableOpacity 
              key={pill} 
              style={[styles.pill, activePill === pill && styles.pillActive]}
              onPress={() => setActivePill(pill)}
            >
              <Text style={[styles.pillText, activePill === pill && styles.pillTextActive]}>{pill}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Spotlight Section */}
            {(activePill === 'All' || activePill === 'Spotlight') && spotlight.length > 0 && (
              <View style={styles.section}>
                {renderSectionHeader('Spotlight', () => {})}
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
                  data={spotlight}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.spotlightCard} onPress={() => playTrack(item, spotlight)}>
                      <Image source={{ uri: item.cover_url || undefined }} style={styles.spotlightImage} />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.spotlightGradient}
                      />
                      <View style={styles.spotlightContent}>
                        <Text style={styles.spotlightTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.spotlightArtist} numberOfLines={1}>{item.artist_name}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Genres Section */}
            {(activePill === 'All' || activePill === 'Genres') && (
              <View style={styles.section}>
                {renderSectionHeader('Genres', () => {})}
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  data={GENRES}
                  keyExtractor={(item) => item.name}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.genreCard, { backgroundColor: item.color }]}
                      onPress={() => router.push({ pathname: '/genre/[name]', params: { name: item.name } })}
                    >
                      <Text style={styles.genreCardTitle}>{item.name}</Text>
                      <Ionicons name={item.icon as any} size={40} color="rgba(255,255,255,0.2)" style={styles.genreCardIcon} />
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Trending Section */}
            {(activePill === 'All' || activePill === 'Trending') && trending.length > 0 && (
              <View style={styles.section}>
                {renderSectionHeader('Trending', () => {})}
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
                  data={trending}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.trendingCard} onPress={() => playTrack(item, trending)}>
                      <Image source={{ uri: item.cover_url || undefined }} style={styles.trendingImage} />
                      <Text style={styles.trendingTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.trendingArtist} numberOfLines={1}>{item.artist_name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  searchIcon: {
    padding: 8,
  },
  pillsContainer: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  pillActive: {
    borderColor: '#E91E63', // Neon pink for active tab as seen in screenshot
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
  },
  pillText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  spotlightCard: {
    width: width * 0.45,
    height: width * 0.75,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.card,
  },
  spotlightImage: {
    width: '100%',
    height: '100%',
  },
  spotlightGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  spotlightContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  spotlightTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  spotlightArtist: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  genreCard: {
    width: width * 0.4,
    height: 90,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  genreCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    zIndex: 2,
    width: '80%',
  },
  genreCardIcon: {
    position: 'absolute',
    bottom: -5,
    right: -10,
    zIndex: 1,
  },
  trendingCard: {
    width: 140,
  },
  trendingImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.card,
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  trendingArtist: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
