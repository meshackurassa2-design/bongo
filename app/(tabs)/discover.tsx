import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// Deducting approximate bottom tab bar height and top notch
// We can use a slightly flexible approach using flex: 1 but FlatList items need exact height if pagingEnabled
// Since standard Bottom Tab is ~50px and top status bar is ~40px, but flex: 1 is best.
// Wait, for FlatList pagingEnabled on Android/iOS, if the FlatList itself is flex: 1, 
// the items should be equal to the FlatList's layout height.
// Let's use an onLayout to get exact height.

export default function DiscoverScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  
  const [feedData, setFeedData] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(height);
  const [likedTracks, setLikedTracks] = useState<Record<string, boolean>>({});
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadingSoundRef = useRef<boolean>(false);
  const [isPlayingSnippet, setIsPlayingSnippet] = useState(false);

  useEffect(() => {
    loadDiscoverFeed();
  }, []);

  const loadDiscoverFeed = async () => {
    setLoading(true);
    try {
      // Fetch random popular tracks to discover    try {
      const { data, error } = await supabase
        .from('tracks')
        .select(`
          *,
          profile:profiles!tracks_user_id_fkey(*)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      const shuffled = (data || []).sort(() => 0.5 - Math.random());
      setFeedData(shuffled as Track[]);

      // Fetch user's likes for these tracks (silently fail if table doesn't exist yet)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const trackIds = shuffled.map(t => t.id);
          const { data: likesData } = await supabase
            .from('track_likes')
            .select('track_id')
            .eq('user_id', user.id)
            .in('track_id', trackIds);

          if (likesData) {
            const likesMap: Record<string, boolean> = {};
            likesData.forEach(like => {
              likesMap[like.track_id] = true;
            });
            setLikedTracks(likesMap);
          }
        }
      } catch (likesErr) {
        // track_likes table may not exist yet — silently ignore
        console.log('track_likes not ready yet:', likesErr);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const playSnippet = async (audioUrl: string) => {
    if (loadingSoundRef.current) return; // Prevent race conditions
    
    await stopSnippet();
    
    try {
      loadingSoundRef.current = true;
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
      setIsPlayingSnippet(true);
    } catch (e) {
      console.log('Error playing snippet', e);
    } finally {
      loadingSoundRef.current = false;
    }
  };

  const stopSnippet = async () => {
    if (soundRef.current) {
      const sound = soundRef.current;
      soundRef.current = null;
      setIsPlayingSnippet(false);
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
      } catch (e) {
        console.log('Error stopping snippet', e);
      }
    }
  };

  const toggleLike = async (track: Track, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const isLiked = likedTracks[track.id] || false;
    
    // Optimistic UI update
    setLikedTracks(prev => ({ ...prev, [track.id]: !isLiked }));
    setFeedData(prev => {
      const newData = [...prev];
      newData[index] = {
        ...newData[index],
        like_count: isLiked ? Math.max(0, newData[index].like_count - 1) : newData[index].like_count + 1
      };
      return newData;
    });

    try {
      const { error } = await supabase.rpc('toggle_track_like', { p_track_id: track.id });
      if (error) {
        console.error('Error toggling like:', error);
        // Revert UI update on error
        setLikedTracks(prev => ({ ...prev, [track.id]: isLiked }));
        setFeedData(prev => {
          const newData = [...prev];
          newData[index] = {
            ...newData[index],
            like_count: track.like_count // original
          };
          return newData;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle playing audio based on visible item
  useEffect(() => {
    if (feedData.length > 0 && activeIndex >= 0 && activeIndex < feedData.length) {
      playSnippet(feedData[activeIndex].audio_url);
    }
    return () => {
      stopSnippet();
    };
  }, [activeIndex, feedData]);

  // Handle pause when leaving tab
  useFocusEffect(
    useCallback(() => {
      // Screen focused
      if (soundRef.current && !isPlayingSnippet) {
        soundRef.current.playAsync();
        setIsPlayingSnippet(true);
      }
      return () => {
        // Screen blurred
        if (soundRef.current) {
          soundRef.current.pauseAsync().catch(() => {});
          setIsPlayingSnippet(false);
        }
        // Also kill global player
        usePlayerStore.getState().pause();
      };
    }, [])
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 16 }}>Finding Artists...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.searchBtn} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={{ width: 44 }} />
      </View>
      
      <View 
        style={{ flex: 1 }} 
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
      >
        <FlatList
          data={feedData}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index }) => (
            <View style={{ width, height: listHeight }}>
              {/* Background Art with fallback color if no image */}
              {((item as any).profile?.avatar_url || item.cover_url) ? (
                <Image 
                  source={{ uri: (item as any).profile?.avatar_url || item.cover_url }} 
                  style={StyleSheet.absoluteFillObject} 
                  contentFit="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a2e' }]} />
              )}
              
              {/* Overlay Gradient */}
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.95)']}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Top gradient for back button visibility if needed */}
              <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100 }}
              />

              {/* Content Box at Bottom */}
              <View style={styles.contentBox}>
                <View style={styles.artistInfo}>
                  <Text style={styles.artistName}>{(item as any).profile?.display_name || item.artist_name}</Text>
                  <Text style={styles.trackTitle}>♫ {item.title}</Text>
                  
                  {/* Genre / Tags */}
                  <View style={styles.tagWrap}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{item.genre}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Top Track</Text>
                    </View>
                  </View>
                </View>

                {/* Right Side Actions */}
                <View style={styles.actionsBox}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    // Add Follow logic here
                  }}>
                    <View style={styles.avatarWrap}>
                      <Image source={{ uri: (item as any).profile?.avatar_url || item.cover_url }} style={styles.smallAvatar} />
                      <View style={styles.followBadge}>
                        <Ionicons name="add" size={14} color="#000" />
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item, index)}>
                    <Ionicons 
                      name={likedTracks[item.id] ? "heart" : "heart-outline"} 
                      size={32} 
                      color={likedTracks[item.id] ? COLORS.gold : COLORS.textPrimary} 
                    />
                    <Text style={styles.actionText}>{item.like_count > 1000 ? `${(item.like_count/1000).toFixed(1)}k` : item.like_count}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  searchBtn: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  contentBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24, // accommodate tab bar if needed, but flex: 1 on FlatList container handles it
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  artistInfo: {
    flex: 1,
    paddingRight: 20,
    paddingBottom: 10,
  },
  artistName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  tagWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsBox: {
    alignItems: 'center',
    gap: 24,
    paddingBottom: 10,
  },
  actionBtn: {
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  smallAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  followBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: COLORS.gold,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playFullBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  }
});
