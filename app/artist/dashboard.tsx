import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';


type TrackStat = {
  id: string;
  title: string;
  play_count: number;
  like_count: number;
};

type AnalyticsData = {
  totalPlays: number;
  totalMinutes: number;
  totalLikes: number;
  topCountries: { code: string; count: number }[];
  myTracks: TrackStat[];
};

export default function ArtistDashboardScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);

  const [data, setData] = useState<AnalyticsData>({
    totalPlays: 0,
    totalMinutes: 0,
    totalLikes: 0,
    topCountries: [],
    myTracks: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const loadAnalytics = async () => {
    if (!session?.user) return;
    setLoading(true);

    try {
      // 1. Get total likes and plays from tracks table (lifetime stats)
      const { data: trackData, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, play_count, like_count')
        .eq('user_id', session.user.id);

      if (trackError) throw trackError;

      let totalPlays = 0;
      let totalLikes = 0;
      trackData?.forEach(t => {
        totalPlays += t.play_count;
        totalLikes += t.like_count;
      });

      // 2. Get detailed analytics from track_events
      const { data: eventData, error: eventError } = await supabase
        .from('track_events')
        .select('duration_listened_sec, country_code, tracks!inner(user_id)')
        .eq('tracks.user_id', session.user.id);

      if (eventError) throw eventError;

      let totalSeconds = 0;
      const countryCounts: Record<string, number> = {};

      eventData?.forEach(e => {
        totalSeconds += e.duration_listened_sec || 0;
        const code = e.country_code || 'Unknown';
        countryCounts[code] = (countryCounts[code] || 0) + 1;
      });

      // Sort countries by count
      const topCountries = Object.entries(countryCounts)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5

      // Sort tracks by play count
      const myTracks = (trackData || []).map(t => ({
        id: t.id,
        title: t.title,
        play_count: t.play_count,
        like_count: t.like_count
      })).sort((a, b) => b.play_count - a.play_count);

      setData({
        totalPlays,
        totalLikes,
        totalMinutes: Math.floor(totalSeconds / 60),
        topCountries,
        myTracks,
      });

    } catch (err: any) {
      console.error(err);
      Alert.alert('Error loading analytics', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const handleDeleteTrack = async (trackId: string, trackTitle: string) => {
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${trackTitle}"? This will remove the song and all its analytics.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('tracks').delete().eq('id', trackId);
              if (error) throw error;
              Alert.alert('Deleted', 'Song deleted successfully.');
              loadAnalytics(); // Refresh the stats
            } catch (err: any) {
              Alert.alert('Error deleting song', err.message);
            }
          }
        }
      ]
    );
  };

  if (profile?.role !== 'artist' && profile?.role !== 'admin') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>Artist Access Required</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artist Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Top Stat Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="play" size={24} color={COLORS.gold} />
                <Text style={styles.statValue}>{data.totalPlays.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Lifetime Plays</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="time" size={24} color={COLORS.gold} />
                <Text style={styles.statValue}>{data.totalMinutes.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Minutes Listened</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="heart" size={24} color={COLORS.gold} />
                <Text style={styles.statValue}>{data.totalLikes.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Likes</Text>
              </View>
            </View>

            {/* Listener Countries */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Listener Countries</Text>
              <View style={styles.card}>
                {data.topCountries.length === 0 ? (
                  <Text style={styles.emptyText}>Not enough data yet.</Text>
                ) : (
                  data.topCountries.map((c, i) => (
                    <View key={c.code} style={[styles.countryRow, i === data.topCountries.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.countryLeft}>
                        <Text style={styles.rank}>#{i + 1}</Text>
                        <Text style={styles.countryName}>{c.code}</Text>
                      </View>
                      <Text style={styles.countryCount}>{c.count.toLocaleString()} plays</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* My Songs */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Songs</Text>
              <View style={styles.card}>
                {data.myTracks.length === 0 ? (
                  <Text style={styles.emptyText}>You haven't uploaded any songs yet.</Text>
                ) : (
                  data.myTracks.map((track, i) => (
                    <View key={track.id} style={[styles.trackRow, i === data.myTracks.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.trackInfo}>
                        <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.trackStats}>
                          <Ionicons name="play" size={12} color={COLORS.textSecondary} /> {track.play_count.toLocaleString()}  •  
                          <Ionicons name="heart" size={12} color={COLORS.textSecondary} /> {track.like_count.toLocaleString()}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteTrack(track.id, track.title)}>
                        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 60 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { 
    flex: 1, 
    minWidth: '45%', 
    backgroundColor: COLORS.card, 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: COLORS.divider,
    alignItems: 'center',
  },
  statValue: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', marginTop: 12, marginBottom: 4 },
  statLabel: { color: COLORS.textSecondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  section: { marginBottom: 24 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider, padding: 16 },
  emptyText: { color: COLORS.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: 12 },
  
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  countryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { color: COLORS.textTertiary, fontSize: 14, fontWeight: '700', width: 24 },
  countryName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  countryCount: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  trackInfo: { flex: 1, paddingRight: 16 },
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  trackStats: { color: COLORS.textSecondary, fontSize: 13 },
  deleteBtn: { padding: 8, backgroundColor: COLORS.cardAlt, borderRadius: 8 }
});
