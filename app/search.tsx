import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { Track, Profile } from '../constants';
import { usePlayerStore } from '../store/playerStore';
import TrackItem from '../components/TrackItem';
import { debounce } from '../utils/helpers';
import { Swipeable } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');
const CATEGORY_WIDTH = (width - 48) / 2;

const DEFAULT_CATEGORIES = [
  { id: '1', title: 'Bongo Flava', color: '#E13300' },
  { id: '2', title: 'Hip Hop', color: '#1E3264' },
  { id: '3', title: 'Afrobeats', color: '#E8115B' },
  { id: '4', title: 'Gospel', color: '#148A08' },
  { id: '5', title: 'Singeli', color: '#E91429' },
  { id: '6', title: 'New Releases', color: '#8D67AB' },
];

export default function SearchScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const playTrack = usePlayerStore(s => s.playTrack);
  const addTrackToQueue = usePlayerStore(s => s.addTrackToQueue);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [query, setQuery] = useState(q || '');
  const [artists, setArtists] = useState<Profile[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    loadRecent();
    if (q) performSearch(q);
  }, []);

  const loadRecent = async () => {
    const saved = await AsyncStorage.getItem('@search_history');
    if (saved) setRecentSearches(JSON.parse(saved));
  };

  const saveRecent = async (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(t => t !== term)].slice(0, 8);
    setRecentSearches(updated);
    await AsyncStorage.setItem('@search_history', JSON.stringify(updated));
  };

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setArtists([]);
      setTracks([]);
      return;
    }
    setLoading(true);
    try {
      const [artistsRes, tracksRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .ilike('display_name', `%${searchTerm}%`)
          .eq('role', 'artist')
          .limit(5),
        supabase
          .from('tracks')
          .select('*, profile:profiles(*)')
          .ilike('title', `%${searchTerm}%`)
          .eq('is_public', true)
          .limit(15)
      ]);
      setArtists(artistsRes.data as Profile[] || []);
      setTracks(tracksRes.data as Track[] || []);
    } catch (e) {
      console.log('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(performSearch, 500), []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const renderRightActions = (track: Track) => {
    return (
      <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16, height: 60 }}>
        <View style={{ backgroundColor: COLORS.gold, padding: 8, borderRadius: 20 }}>
          <Ionicons name="add" size={20} color={COLORS.black} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>

      {/* Modern Floating Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={22} color={COLORS.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="What do you want to listen to?"
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={() => saveRecent(query)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onChangeQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />}

      <FlatList 
        showsVerticalScrollIndicator={false}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Default State: Browse Categories & Recent Searches */}
            {query.length === 0 && (
              <View style={{ paddingHorizontal: 16 }}>
                {recentSearches.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionLabel}>Recent searches</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {recentSearches.map((term, index) => (
                        <TouchableOpacity 
                          key={index}
                          style={styles.recentPill}
                          onPress={() => onChangeQuery(term)}
                        >
                          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                          <Text style={{ color: COLORS.textPrimary, fontSize: 14 }}>{term}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={styles.sectionLabel}>Browse all</Text>
                <View style={styles.grid}>
                  {DEFAULT_CATEGORIES.map(cat => (
                    <TouchableOpacity key={cat.id} style={[styles.categoryCard, { backgroundColor: cat.color }]}>
                      <Text style={styles.categoryTitle}>{cat.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Active Search Results */}
            {query.length > 0 && (
              <>
                {artists.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 16 }]}>Artists</Text>
                    <FlatList 
                      data={artists}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 16, gap: 16, marginTop: 12 }}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item: artist }) => (
                        <TouchableOpacity
                          style={styles.artistCard}
                          onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
                        >
                          <View style={styles.artistAvatarLg}>
                            {artist.avatar_url
                              ? <Image source={{ uri: artist.avatar_url }} style={styles.artistAvatarImgLg} transition={200} cachePolicy="memory-disk" />
                              : <Ionicons name="person" size={40} color={COLORS.textSecondary} />
                            }
                          </View>
                          <Text style={styles.artistNameCenter} numberOfLines={1}>{artist.display_name}</Text>
                          {artist.is_verified && <View style={styles.badge}><Ionicons name="checkmark-circle" size={14} color={COLORS.gold} /></View>}
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}

                {tracks.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginBottom: 8 }]}>Songs</Text>
                    {tracks.map(track => (
                      <Swipeable 
                        key={track.id} 
                        renderRightActions={() => renderRightActions(track)}
                        onSwipeableOpen={(direction) => {
                          if (direction === 'right') {
                            addTrackToQueue(track);
                          }
                        }}
                      >
                        <TrackItem
                          track={track}
                          isPlaying={currentTrack?.id === track.id}
                          onPress={() => playTrack(track, tracks)}
                          onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.user_id } })}
                        />
                      </Swipeable>
                    ))}
                  </>
                )}

                {!loading && tracks.length === 0 && artists.length === 0 && (
                  <View style={styles.empty}>
                    <Ionicons name="search" size={64} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>No results found for "{query}"</Text>
                    <Text style={styles.emptyText}>Please make sure your words are spelled correctly or use less or different keywords.</Text>
                  </View>
                )}
              </>
            )}
          </>
        }
        contentContainerStyle={{ paddingBottom: 160 }}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginHorizontal: 16, marginBottom: 16, marginTop: 20 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 8, 
    marginHorizontal: 16, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    gap: 12, 
    marginBottom: 20 
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  sectionLabel: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  categoryCard: {
    width: CATEGORY_WIDTH,
    height: 100,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  categoryTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  recentPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  artistCard: { alignItems: 'center', width: 100, position: 'relative' },
  artistAvatarLg: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 8 },
  artistAvatarImgLg: { width: 90, height: 90, borderRadius: 45 },
  artistNameCenter: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  badge: { position: 'absolute', bottom: 25, right: 5, backgroundColor: COLORS.black, borderRadius: 10, padding: 2 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
