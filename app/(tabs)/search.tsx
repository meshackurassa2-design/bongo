import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track, Profile } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import TrackItem from '../../components/TrackItem';
import { debounce } from '../../utils/helpers';

export default function SearchScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [query, setQuery] = useState(q || '');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (q) {
      doSearch(q);
    }
  }, [q]);

  const doSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) { setTracks([]); setArtists([]); return; }
    setLoading(true);
    const [tRes, aRes] = await Promise.all([
      supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true)
        .or(`title.ilike.%${searchTerm}%,artist_name.ilike.%${searchTerm}%,genre.ilike.%${searchTerm}%`).limit(30),
      supabase.from('profiles').select('*').eq('role', 'artist')
        .or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`).limit(15),
    ]);
    if (tRes.data) setTracks(tRes.data as Track[]);
    if (aRes.data) setArtists(aRes.data as Profile[]);
    setLoading(false);
  };

  const debouncedSearch = useCallback(debounce(doSearch, 350), []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    debouncedSearch(text);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tafuta</Text>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.gold} />
        <TextInput
          style={styles.input}
          placeholder="Tafuta nyimbo, wasanii..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={onChangeQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setTracks([]); setArtists([]); }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />}

      <FlatList showsVerticalScrollIndicator={false}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {artists.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Wasanii</Text>
                {artists.map(artist => (
                  <TouchableOpacity
                    key={artist.id}
                    style={styles.artistRow}
                    onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
                  >
                    <View style={styles.artistAvatar}>
                      {artist.avatar_url
                        ? <Image source={{ uri: artist.avatar_url }} style={styles.artistAvatarImg} transition={200} cachePolicy="memory-disk" />
                        : <Ionicons name="person" size={24} color={COLORS.textSecondary} />
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.artistName}>{artist.display_name}</Text>
                        {artist.is_verified && <Ionicons name="checkmark-circle" size={14} color={COLORS.gold} />}
                      </View>
                      <Text style={styles.artistMeta}>{artist.follower_count} wafuasi · {artist.track_count} nyimbo</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
              </>
            )}
            {tracks.length > 0 && <Text style={styles.sectionLabel}>Nyimbo</Text>}
            {tracks.map(track => (
              <TrackItem
                key={track.id}
                track={track}
                isPlaying={currentTrack?.id === track.id}
                onPress={() => playTrack(track, tracks)}
                onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.user_id } })}
              />
            ))}
            {!loading && query.length > 0 && tracks.length === 0 && artists.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="search" size={64} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Hakuna Matokeo</Text>
                <Text style={styles.emptyText}>Jaribu kutafuta kitu kingine.</Text>
              </View>
            )}
            {query.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="headset" size={64} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Tafuta Muziki</Text>
                <Text style={styles.emptyText}>Tafuta nyimbo na wasanii unaowapenda.</Text>
              </View>
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
  title: { color: COLORS.gold, fontSize: 26, fontWeight: '900', marginHorizontal: 16, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginBottom: 8 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  sectionLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700', marginHorizontal: 16, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  artistRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  artistAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  artistAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  artistName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  artistMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
});
