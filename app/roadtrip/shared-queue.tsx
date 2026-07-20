import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useThemeStore } from '../../store/themeStore';
import { useRoadTripStore } from '../../store/roadTripStore';
import { usePlayerStore } from '../../store/playerStore';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Track } from '../../constants';
import TrackItem from '../../components/TrackItem';
import { Image } from 'expo-image';

export default function SharedQueueScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { isHost, sharedQueue, participants, addTrack } = useRoadTripStore();
  const { currentTrack } = usePlayerStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    const { data } = await supabase
      .from('tracks')
      .select('*, profile:profiles!tracks_user_id_fkey(*)')
      .ilike('title', `%${query}%`)
      .limit(10);
      
    if (data) {
      setSearchResults(data as Track[]);
    }
    setSearching(false);
  };

  const handleAdd = (track: Track) => {
    addTrack(track);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      
      {/* Current Track Banner */}
      <View style={styles.nowPlaying}>
        <Text style={styles.nowPlayingLabel}>Now Playing {isHost && '(Host)'}</Text>
        {currentTrack ? (
          <View style={styles.npRow}>
            <Image source={{ uri: currentTrack.cover_url || undefined }} style={styles.npImage} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.npTitle} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={styles.npArtist} numberOfLines={1}>{currentTrack.artist_name}</Text>
            </View>
            <Ionicons name="musical-notes" size={24} color={COLORS.gold} />
          </View>
        ) : (
          <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>Nothing playing right now. Add a song below!</Text>
        )}
      </View>

      {/* Participants */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ color: COLORS.textTertiary, fontSize: 12 }}>
          {participants.length} connected in the car
        </Text>
      </View>

      {/* Shared Queue */}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>Up Next</Text>
        <FlatList
          data={sharedQueue.filter(t => t.id !== currentTrack?.id)}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.queueItem}>
              <Text style={styles.queueIndex}>{index + 1}</Text>
              <Image source={{ uri: item.cover_url || undefined }} style={styles.queueImage} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.queueTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.queueArtist} numberOfLines={1}>{item.artist_name}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <Ionicons name="list" size={40} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>Queue is empty</Text>
            </View>
          )}
        />
      </View>

      {/* Add Song Section */}
      <View style={styles.addSection}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color={COLORS.textTertiary} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Bongo Stream to add..."
            placeholderTextColor={COLORS.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searching && <ActivityIndicator color={COLORS.gold} style={{ marginRight: 12 }} />}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            <FlatList
              data={searchResults}
              keyExtractor={item => `search-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchItem} onPress={() => handleAdd(item)}>
                  <Image source={{ uri: item.cover_url || undefined }} style={styles.searchItemImg} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.searchItemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.searchItemArtist} numberOfLines={1}>{item.artist_name}</Text>
                  </View>
                  <Ionicons name="add-circle" size={28} color={COLORS.gold} />
                </TouchableOpacity>
              )}
              style={{ maxHeight: 200 }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  nowPlaying: { margin: 16, padding: 16, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.gold + '40' },
  nowPlayingLabel: { color: COLORS.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  npRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  npImage: { width: 48, height: 48, borderRadius: 8 },
  npTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  npArtist: { color: COLORS.textSecondary, fontSize: 13 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', paddingHorizontal: 16, paddingBottom: 12 },
  
  queueItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  queueIndex: { color: COLORS.textTertiary, width: 20, fontWeight: '700', fontSize: 12 },
  queueImage: { width: 40, height: 40, borderRadius: 6 },
  queueTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  queueArtist: { color: COLORS.textSecondary, fontSize: 12 },
  
  emptyWrap: { padding: 40, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, marginTop: 8 },
  
  addSection: { borderTopWidth: 1, borderColor: COLORS.divider, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: COLORS.black },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider },
  searchInput: { flex: 1, padding: 14, color: COLORS.textPrimary, fontSize: 16 },
  searchResults: { marginTop: 12, backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.divider },
  searchItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  searchItemImg: { width: 40, height: 40, borderRadius: 6 },
  searchItemTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  searchItemArtist: { color: COLORS.textSecondary, fontSize: 12 },
});
