import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert, Animated, Easing, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ResizeMode, Video } from 'expo-av';
import { usePlayerStore } from '../store/playerStore';
import { useOfflineStore } from '../store/offlineStore';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { ScrollView, FlatList } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useProgress, usePlaybackState, State } from '../store/playerStore';


const { width } = Dimensions.get('window');

export default function PlayerScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const {
    currentTrack,
    queue,
    reorderQueue,
    isShuffled,
    repeatOne,
    togglePlayPause,
    skipNext,
    skipPrev,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    playbackRate,
    setPlaybackRate,
    sleepTimerMs,
    setSleepTimer,
    clearSleepTimer,
  } = usePlayerStore();

  const isPlayingRef = useRef(false);

  const { downloadTrack, isDownloaded, isDownloading, downloadProgress } = useOfflineStore();

  const { position, duration } = useProgress();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;
  const positionMs = (position || 0) * 1000;
  const durationMs = (duration || 0) * 1000;
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showFxModal, setShowFxModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const session = useAuthStore(s => s.session);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);

  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyrics) return null;
    const lines = currentTrack.lyrics.split('\n');
    const result: { time: number; text: string }[] = [];
    
    const lrcRegex = /\[(\d{2}):(\d{2}\.\d{2})\](.*)/;
    let isLrc = false;
    
    lines.forEach(line => {
      const match = line.match(lrcRegex);
      if (match) {
        isLrc = true;
        const minutes = parseInt(match[1]);
        const seconds = parseFloat(match[2]);
        result.push({
          time: (minutes * 60 + seconds) * 1000,
          text: match[3].trim()
        });
      }
    });
    
    if (!isLrc) {
      // Estimate timings for non-LRC lyrics to create pseudo-sync
      const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('['));
      if (cleanLines.length === 0) return null;
      
      const safeDuration = durationMs || 180000; // default 3 mins if unknown
      
      // Use percentage-based buffering: 12% intro, 75% for vocals
      const introBuffer = safeDuration * 0.12; 
      const usableDuration = safeDuration * 0.75;
      const timePerLine = usableDuration / cleanLines.length;
      
      return cleanLines.map((text, idx) => ({
        time: introBuffer + (idx * timePerLine),
        text
      }));
    }
    
    return result;
  }, [currentTrack?.lyrics, durationMs]);

  const lyricsScrollRef = useRef<FlatList>(null);

  useEffect(() => {
    if (showLyrics && lyricsScrollRef.current && activeLyricIndex >= 0 && parsedLyrics) {
      try {
        lyricsScrollRef.current.scrollToIndex({ index: activeLyricIndex, animated: true, viewPosition: 0.5 });
      } catch (e) {
        // FlatList scrollToIndex might fail if items are not rendered yet
      }
    }
  }, [activeLyricIndex, showLyrics, parsedLyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics) return -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (positionMs >= parsedLyrics[i].time) {
        return i;
      }
    }
    return 0;
  }, [positionMs, parsedLyrics]);

  const openPlaylistModal = async () => {
    if (!session) {
      Alert.alert('Login Required', 'You must be logged in to add songs to a playlist.');
      router.push('/auth');
      return;
    }
    setShowPlaylistModal(true);
    setLoadingPlaylists(true);
    const { data } = await supabase.from('playlists').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (data) setMyPlaylists(data);
    setLoadingPlaylists(false);
  };



  const addToPlaylist = async (playlistId: string) => {
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      track_id: currentTrack?.id
    });
    if (error) {
      if (error.code === '23505') Alert.alert('Notice', 'Song is already in this playlist!');
      else Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Song added to playlist!');
      setShowPlaylistModal(false);
      
      const pl = myPlaylists.find(p => p.id === playlistId);
      if (pl) {
        await supabase.from('playlists').update({ track_count: (pl.track_count || 0) + 1 }).eq('id', playlistId);
      }
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    try {
      setIsSharing(true);
      const { Share } = require('react-native');
      const shareLink = `https://bongostream.app/song/${currentTrack.id}`;
      const shareMessage = `Inacheza sasa: "${currentTrack.title}" na ${currentTrack.artist_name} kwenye BongoStream!\n\nSikiliza hapa: ${shareLink}`;
      
      await Share.share({
        message: shareMessage,
        title: currentTrack.title,
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to share track');
    } finally {
      setIsSharing(false);
    }
  };

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const armAnim = useRef(new Animated.Value(-30)).current;
  const flyX = useRef(new Animated.Value(0)).current;
  const flyY = useRef(new Animated.Value(0)).current;

  const currentSpin = useRef(0);
  const spinLoop = useRef<any>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchPosMs, setScratchPosMs] = useState(0);

  // Generate static dust particles so they don't re-render randomly
  const dustParticles = useMemo(() => {
    return [...Array(45)].map((_, i) => ({
      top: `${Math.random() * 90 + 5}%`,
      left: `${Math.random() * 90 + 5}%`,
      width: Math.random() * 5 + 1,
      height: Math.random() * 5 + 1,
      opacity: Math.random() * 0.6 + 0.2,
      rotate: `${Math.random() * 360}deg`,
      isGrime: Math.random() > 0.7
    }));
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    let isMounted = true;
    const flyAnim = () => {
      if (!isMounted) return;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(flyX, { toValue: Math.random() * 200 - 100, duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
          Animated.timing(flyY, { toValue: Math.random() * 200 - 100, duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true })
        ]),
        Animated.parallel([
          Animated.timing(flyX, { toValue: Math.random() * 300 - 150, duration: 200, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(flyY, { toValue: Math.random() * 300 - 150, duration: 200, easing: Easing.linear, useNativeDriver: true })
        ]),
        Animated.parallel([
          Animated.timing(flyX, { toValue: Math.random() * 150 - 75, duration: 500, easing: Easing.bezier(0.42, 0, 1, 1), useNativeDriver: true }),
          Animated.timing(flyY, { toValue: Math.random() * 150 - 75, duration: 500, easing: Easing.bezier(0.42, 0, 1, 1), useNativeDriver: true })
        ]),
        // Small pause
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(flyX, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(flyY, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ]).start(({ finished }) => {
        if (finished && isMounted) flyAnim();
      });
    };
    flyAnim();
    return () => { isMounted = false; };
  }, []);

  const startSpin = () => {
    spinLoop.current = Animated.timing(spinAnim, {
      toValue: currentSpin.current + 1,
      duration: 3000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    spinLoop.current.start(({ finished }) => {
      if (finished && isPlaying && !isScratching) {
        currentSpin.current += 1;
        startSpin();
      }
    });
  };

  useEffect(() => {
    const activePos = isScratching ? scratchPosMs : positionMs;
    const safeDuration = Math.max(1, durationMs || 1);
    const progress = activePos / safeDuration;
    const targetAngle = isNaN(progress) ? 18 : 18 + (progress * 22); // Outer groove (18deg) to inner groove (40deg)

    // Animate the tonearm
    Animated.spring(armAnim, {
      toValue: (isPlaying || isScratching) ? targetAngle : -30,
      useNativeDriver: true,
      friction: 8,
      tension: 50
    }).start();
  }, [isPlaying, isScratching, positionMs, durationMs, scratchPosMs]);

  useEffect(() => {
    if (isPlaying && !isScratching) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.03, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ).start();
      
      startSpin();
    } else {
      scaleAnim.stopAnimation();
      pulseAnim.stopAnimation();
      spinAnim.stopAnimation((val) => { currentSpin.current = val; });
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    
    return () => {
      if (spinLoop.current) spinLoop.current.stop();
    };
  }, [isPlaying, isScratching]);

  // Lyrics Slide Animation
  const slideLyricsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideLyricsAnim, {
      toValue: showLyrics ? 1 : 0,
      duration: 450,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
    }).start();
  }, [showLyrics]);

  const vinylTranslateX = slideLyricsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(width * 1.2)],
  });

  const lyricsTranslateX = slideLyricsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [width * 1.2, 0],
  });

  const vinylOpacity = slideLyricsAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
  });

  const lyricsOpacity = slideLyricsAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
  });

  const spin = spinAnim.interpolate({
    inputRange: [-100, 100],
    outputRange: ['-36000deg', '36000deg']
  });

  const armRotation = armAnim.interpolate({
    inputRange: [-30, 45],
    outputRange: ['-30deg', '45deg']
  });

  const flyRotation = flyX.interpolate({
    inputRange: [-150, 150],
    outputRange: ['-60deg', '60deg']
  });

  const lastSeek = useRef(0);
  const initialScratchPos = useRef(0);
  const wasPlaying = useRef(false);
  const positionMsRef = useRef(0);

  useEffect(() => {
    positionMsRef.current = positionMs;
  }, [positionMs]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 5,
      onPanResponderGrant: () => {
        setIsScratching(true);
        wasPlaying.current = isPlayingRef.current;
        if (isPlayingRef.current) togglePlayPause();
        
        const currentPos = positionMsRef.current;
        initialScratchPos.current = currentPos;
        setScratchPosMs(currentPos);
        spinAnim.stopAnimation((val) => { currentSpin.current = val; });
      },
      onPanResponderMove: (evt, gestureState) => {
        // Rotate visually based on horizontal drag
        const deltaRot = gestureState.dx / 150;
        spinAnim.setValue(currentSpin.current + deltaRot);

        // Calculate scrub position (width of screen = 30 seconds scrub)
        const deltaMs = (gestureState.dx / width) * 30000;
        const newPos = Math.max(0, Math.min(durationMs, initialScratchPos.current + deltaMs));
        setScratchPosMs(newPos);
        
        // Throttle seekTo to avoid stuttering
        if (Date.now() - lastSeek.current > 200) {
          seekTo(newPos);
          lastSeek.current = Date.now();
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsScratching(false);
        const deltaRot = gestureState.dx / 150;
        currentSpin.current += deltaRot;
        
        const deltaMs = (gestureState.dx / width) * 30000;
        seekTo(Math.max(0, Math.min(durationMs, initialScratchPos.current + deltaMs)));
        
        if (wasPlaying.current) {
          setTimeout(() => {
            if (!isPlayingRef.current) togglePlayPause();
          }, 300); // Slight delay to let seek resolve
        }
      },
      onPanResponderTerminate: (evt, gestureState) => {
        setIsScratching(false);
        if (wasPlaying.current) {
          setTimeout(() => {
            if (!isPlayingRef.current) togglePlayPause();
          }, 300);
        }
      }
    })
  ).current;


  useEffect(() => {
    if (!sleepTimerMs) {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.max(0, sleepTimerMs - Date.now());
      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMs]);


  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Canvas Video Background */}
      <Video
        source={{ uri: 'https://cdn.pixabay.com/video/2018/01/22/13859-252504829_tiny.mp4' }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
      />
      <LinearGradient colors={['rgba(26,26,26,0.7)', COLORS.black]} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inacheza Sasa</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSleepTimer(true)}>
          <Ionicons name={sleepTimerMs ? "alarm" : "alarm-outline"} size={26} color={sleepTimerMs ? COLORS.gold : COLORS.textPrimary} />
          {timeLeft && <Text style={{ color: COLORS.gold, fontSize: 10, fontWeight: '700', marginTop: 2, width: 56, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{timeLeft}</Text>}
        </TouchableOpacity>
      </View>

      {/* Professional DJ Vinyl Art OR Lyrics */}
      <View style={{ width: '100%', height: width - 60, marginBottom: 24, justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Lyrics View */}
        <Animated.View pointerEvents={showLyrics ? 'auto' : 'none'} style={{ position: 'absolute', width: '100%', height: '100%', transform: [{ translateX: lyricsTranslateX }], opacity: lyricsOpacity, zIndex: showLyrics ? 10 : 1 }}>
          <FlatList 
            ref={lyricsScrollRef}
            data={parsedLyrics}
            keyExtractor={(item, index) => index.toString()}
            style={{ width: width - 60, height: width - 60, alignSelf: 'center', paddingHorizontal: 20 }} 
            contentContainerStyle={{ paddingVertical: 100, alignItems: 'center' }}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                lyricsScrollRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
              });
            }}
            renderItem={({ item, index }) => {
              const isActive = index === activeLyricIndex;
              return (
                <Text 
                  style={{
                    color: isActive ? COLORS.gold : COLORS.textTertiary,
                    fontSize: isActive ? 24 : 18,
                    fontWeight: isActive ? '800' : '600',
                    textAlign: 'center',
                    marginBottom: 20,
                    opacity: isActive ? 1 : 0.6
                  }}
                >
                  {item.text || '♪'}
                </Text>
              );
            }}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
                <Ionicons name="mic-off-outline" size={64} color={COLORS.textTertiary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>No synced lyrics available.</Text>
              </View>
            )}
          />
        </Animated.View>

        {/* Vinyl View */}
        <Animated.View pointerEvents={showLyrics ? 'none' : 'auto'} style={{ position: 'absolute', width: width - 60, height: width - 60, transform: [{ translateX: vinylTranslateX }], opacity: vinylOpacity, zIndex: showLyrics ? 1 : 10 }}>
          <View style={[styles.coverWrap, { marginBottom: 0 }]} {...panResponder.panHandlers}>
          {/* Outer Turntable Platter (Static) */}
        <View style={styles.platterBase}>
          <View style={styles.platterDots} />
        </View>

        {isPlaying && (
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.6, 0] }) }]} />
        )}

        {/* Spinning Vintage Vinyl Record */}
        <Animated.View style={[styles.vinylRecord, { transform: [{ scale: scaleAnim }, { rotate: spin }] }]}>
          {/* Heavy Grime Base Layer */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(50, 35, 15, 0.2)' }]} pointerEvents="none" />
          
          {/* Base Vinyl Grooves */}
          <LinearGradient colors={['rgba(255,255,255,0.03)', 'rgba(0,0,0,0.8)', 'rgba(255,255,255,0.03)']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
          <View style={[styles.vinylGroove, { width: width - 90, height: width - 90, opacity: 0.3 }]} />
          <View style={[styles.vinylGroove, { width: width - 110, height: width - 110, opacity: 0.5 }]} />
          <View style={[styles.vinylGroove, { width: width - 130, height: width - 130, opacity: 0.8 }]} />
          <View style={[styles.vinylGroove, { width: width - 160, height: width - 160, opacity: 0.4 }]} />
          <View style={[styles.vinylGroove, { width: width - 180, height: width - 180, opacity: 0.6 }]} />
          
          {/* Sharp Vinyl Glare / Scuffed Sheen */}
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.12)', 'transparent', 'rgba(255,255,255,0.06)', 'transparent']} start={{x: 0.2, y: 0}} end={{x: 0.8, y: 1}} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

          {/* Dirt and Dust Particles */}
          {dustParticles.map((dust, i) => (
            <View key={`dust-${i}`} style={{
              position: 'absolute',
              top: dust.top,
              left: dust.left,
              width: dust.width,
              height: dust.height,
              backgroundColor: dust.isGrime ? '#3a2b1c' : '#e6dfd3',
              opacity: dust.opacity,
              borderRadius: 2,
              transform: [{ rotate: dust.rotate }]
            }} pointerEvents="none" />
          ))}

          {/* Heavy Vintage Scratches */}
          <View style={[styles.vintageScratch, { width: 140, top: '20%', left: '10%', transform: [{ rotate: '43deg' }], opacity: 0.6 }]} />
          <View style={[styles.vintageScratch, { width: 80, top: '70%', left: '15%', transform: [{ rotate: '-12deg' }], opacity: 0.4 }]} />
          <View style={[styles.vintageScratch, { width: 220, top: '50%', left: '2%', transform: [{ rotate: '88deg' }], opacity: 0.3 }]} />
          <View style={[styles.vintageScratch, { width: 60, top: '85%', left: '60%', transform: [{ rotate: '150deg' }], opacity: 0.7 }]} />
          <View style={[styles.vintageScratch, { width: 110, top: '10%', left: '50%', transform: [{ rotate: '25deg' }], opacity: 0.5 }]} />
          <View style={[styles.vintageScratch, { width: 170, top: '40%', left: '30%', transform: [{ rotate: '-65deg' }], opacity: 0.25 }]} />
          <View style={[styles.vintageScratch, { width: 90, top: '30%', left: '70%', transform: [{ rotate: '10deg' }], opacity: 0.5 }]} />

          {/* Micro Scratches & Scuffs */}
          <View style={[styles.microScratch, { width: 40, top: '45%', left: '20%', transform: [{ rotate: '70deg' }] }]} />
          <View style={[styles.microScratch, { width: 50, top: '65%', left: '40%', transform: [{ rotate: '-30deg' }] }]} />
          <View style={[styles.microScratch, { width: 30, top: '15%', left: '80%', transform: [{ rotate: '110deg' }] }]} />
          <View style={[styles.microScratch, { width: 60, top: '80%', left: '25%', transform: [{ rotate: '5deg' }] }]} />
          
          {/* Vinyl Ring Wear (Aged fading outer ring) */}
          <View style={styles.ringWear} pointerEvents="none" />
          
          {/* Center Label (Cover Art) with Vintage Sepia Fade & Paper Wear */}
          <View style={styles.vinylCenterLabel}>
            {currentTrack.cover_url ? (
              <Image source={{ uri: currentTrack.cover_url }} style={{ width: '100%', height: '100%' }} transition={300} cachePolicy="memory-disk" />
            ) : (
              <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e6d5b8' }}>
                <Ionicons name="musical-notes" size={40} color={'#5c4a3d'} />
              </View>
            )}
            {/* Vintage Sepia Tint Overlay */}
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(139, 69, 19, 0.25)' }} pointerEvents="none" />
            {/* Paper Ring Wear Effect on Label */}
            <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 1000, borderWidth: 15, borderColor: 'rgba(0,0,0,0.4)' }} pointerEvents="none" />
            <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 1000, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', margin: 4 }} pointerEvents="none" />
          </View>
          
          {/* Center Spindle Hole */}
          <View style={styles.vinylSpindle} />
        </Animated.View>

        {/* Professional Tonearm (The Staff/Needle) */}
        <Animated.View style={[styles.tonearmContainer, { transform: [{ rotate: armRotation }] }]} pointerEvents="none">
          {/* Base/Pivot */}
          <View style={styles.tonearmBase}>
            <LinearGradient colors={['#333', '#111']} style={StyleSheet.absoluteFillObject} />
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#888', borderWidth: 2, borderColor: '#333' }} />
          </View>
          {/* Main Arm */}
          <LinearGradient colors={['#e0e0e0', '#a0a0a0', '#e0e0e0']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.tonearmStick} />
          {/* Headshell Joint */}
          <View style={styles.tonearmJoint} />
          {/* Headshell/Needle block */}
          <View style={styles.tonearmHead}>
            <LinearGradient colors={['#2a2a2a', '#111']} style={StyleSheet.absoluteFillObject} />
            <View style={{ width: 2, height: 4, backgroundColor: 'red', position: 'absolute', bottom: -2, right: 4 }} />
          </View>
        </Animated.View>

        {/* The Fly */}
        <Animated.View style={{ 
          position: 'absolute', 
          zIndex: 1000, 
          transform: [{ translateX: flyX }, { translateY: flyY }, { rotate: flyRotation }],
          pointerEvents: 'none'
        }}>
          {/* Fly Body */}
          <View style={{ width: 6, height: 10, backgroundColor: '#111', borderRadius: 4 }} />
          {/* Left Wing */}
          <View style={{ position: 'absolute', top: 2, left: -5, width: 6, height: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 3, transform: [{ rotate: '-45deg' }] }} />
          {/* Right Wing */}
          <View style={{ position: 'absolute', top: 2, right: -5, width: 6, height: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 3, transform: [{ rotate: '45deg' }] }} />
        </Animated.View>
          </View>
        </Animated.View>
      </View>

      {/* Info & Actions */}
      <View style={styles.infoRow}>
        <View style={styles.infoWrap}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>{currentTrack.title}</Text>
          <TouchableOpacity onPress={() => {
            router.back();
            setTimeout(() => router.push(`/artist/${currentTrack.user_id}`), 100);
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.artist} numberOfLines={1} adjustsFontSizeToFit>{currentTrack.artist_name}</Text>
              {currentTrack.profile?.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color={COLORS.gold} style={{ marginLeft: 4 }} />
              )}
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.downloadBtn} onPress={openPlaylistModal}>
            <Ionicons name="list" size={26} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleShare}>
            {isSharing ? <ActivityIndicator size="small" color={COLORS.textPrimary} /> : <Ionicons name="share-social-outline" size={26} color={COLORS.textSecondary} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.downloadBtn} 
            onPress={() => !isDownloaded(currentTrack.id) && !isDownloading[currentTrack.id] && downloadTrack(currentTrack)}
          >
            {isDownloading[currentTrack.id] ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.gold} />
                <Text style={{ color: COLORS.gold, fontSize: 10, marginTop: 4, fontWeight: '700' }}>
                  {Math.round((downloadProgress[currentTrack.id] || 0) * 100)}%
                </Text>
              </View>
            ) : (
              <Ionicons 
                name={isDownloaded(currentTrack.id) ? "checkmark-circle" : "cloud-download-outline"} 
                size={28} 
                color={isDownloaded(currentTrack.id) ? COLORS.gold : COLORS.textSecondary} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ marginBottom: 16 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12, alignItems: 'center' }}
        >
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: showLyrics ? COLORS.gold : COLORS.cardAlt 
            }}
            onPress={() => setShowLyrics(!showLyrics)}
          >
            <Ionicons name="mic-outline" size={16} color={showLyrics ? COLORS.black : COLORS.textSecondary} />
            <Text style={{ 
              color: showLyrics ? COLORS.black : COLORS.textSecondary, 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              LYRICS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: playbackRate !== 1.0 ? COLORS.gold : COLORS.cardAlt 
            }}
            onPress={() => setShowFxModal(true)}
          >
            <Ionicons name="color-wand" size={16} color={playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary} />
            <Text style={{ 
              color: playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary, 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              AUDIO EFFECTS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: showQueueModal ? COLORS.gold : COLORS.cardAlt 
            }}
            onPress={() => setShowQueueModal(true)}
          >
            <Ionicons name="list" size={16} color={showQueueModal ? COLORS.black : COLORS.textSecondary} />
            <Text style={{ 
              color: showQueueModal ? COLORS.black : COLORS.textSecondary, 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              UP NEXT
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Seek Bar */}
      <View style={styles.progressWrap}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(durationMs || 1, positionMs + 1)}
          value={positionMs}
          onSlidingComplete={seekTo}
          minimumTrackTintColor={COLORS.gold}
          maximumTrackTintColor={COLORS.divider}
          thumbTintColor={COLORS.gold}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsWrap}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={26} color={isShuffled ? COLORS.gold : COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={skipPrev}>
          <Ionicons name="play-skip-back" size={36} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={COLORS.black} style={{ marginLeft: isPlaying ? 0 : 4 }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={36} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleRepeat}>
          <Ionicons name="repeat" size={26} color={repeatOne ? COLORS.gold : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sleep Timer Modal */}
      <Modal visible={showSleepTimer} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Sleep Timer</Text>
            <Text style={styles.modalSub}>Music will pause automatically</Text>
            
            <View style={{ gap: 12, marginTop: 20 }}>
              {[15, 30, 45, 60].map(mins => (
                <TouchableOpacity 
                  key={mins} 
                  style={styles.sleepOptionBtn}
                  onPress={() => { setSleepTimer(mins); setShowSleepTimer(false); }}
                >
                  <Text style={styles.sleepOptionText}>{mins} Minutes</Text>
                  <Ionicons name="time-outline" size={20} color={COLORS.gold} />
                </TouchableOpacity>
              ))}
              
              {sleepTimerMs && (
                <TouchableOpacity 
                  style={[styles.sleepOptionBtn, { backgroundColor: 'rgba(255,50,50,0.1)', borderColor: 'rgba(255,50,50,0.3)' }]}
                  onPress={() => { clearSleepTimer(); setShowSleepTimer(false); }}
                >
                  <Text style={[styles.sleepOptionText, { color: '#ff5555' }]}>Turn Off Timer</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowSleepTimer(false)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Audio Effects Modal */}
      <Modal visible={showFxModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Audio Effects</Text>
            <Text style={styles.modalSub}>Adjust playback speed and pitch</Text>
            
            <View style={{ marginTop: 30, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>Speed / Pitch</Text>
                <Text style={{ color: COLORS.gold, fontWeight: '700' }}>{playbackRate.toFixed(2)}x</Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0.5}
                maximumValue={2.0}
                step={0.1}
                value={playbackRate}
                onValueChange={setPlaybackRate}
                minimumTrackTintColor={COLORS.gold}
                maximumTrackTintColor={COLORS.divider}
                thumbTintColor={COLORS.gold}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -10 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Slow & Low</Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>Fast & High</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.sleepOptionBtn, { justifyContent: 'center', marginBottom: 16 }]}
              onPress={() => setPlaybackRate(1.0)}
            >
              <Text style={styles.sleepOptionText}>Reset to Normal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowFxModal(false)}>
              <Text style={styles.closeModalText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Playlist Selection Modal */}
      <Modal visible={showPlaylistModal} transparent={true} animationType="slide" onRequestClose={() => setShowPlaylistModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Playlist</Text>
            {loadingPlaylists ? (
              <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 40 }} />
            ) : myPlaylists.length === 0 ? (
              <Text style={{ color: COLORS.textSecondary, marginVertical: 20, textAlign: 'center' }}>You don't have any playlists yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300, width: '100%', marginTop: 20 }}>
                {myPlaylists.map(pl => (
                  <TouchableOpacity key={pl.id} style={styles.playlistOption} onPress={() => addToPlaylist(pl.id)}>
                    <Ionicons name="musical-notes" size={24} color={COLORS.gold} />
                    <Text style={styles.playlistOptionText}>{pl.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPlaylistModal(false)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Queue Modal */}
      <Modal visible={showQueueModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { paddingHorizontal: 0, paddingBottom: 20, maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Up Next</Text>
            
            {queue.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="musical-notes-outline" size={60} color={COLORS.textTertiary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' }}>Your queue is empty.</Text>
                <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginTop: 4, textAlign: 'center' }}>Swipe songs in the list to add them here.</Text>
              </View>
            ) : (
              <DraggableFlatList
                data={queue}
                keyExtractor={(item, idx) => item.id + '-' + idx}
                style={{ marginTop: 20, maxHeight: 450 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                onDragEnd={({ data, from, to }) => {
                  reorderQueue(from, to);
                }}
                renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<any>) => (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginBottom: 16,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    padding: isActive ? 8 : 0,
                    borderRadius: 12,
                    marginHorizontal: isActive ? -8 : 0
                  }}>
                    <Text style={{ color: COLORS.textTertiary, fontSize: 12, width: 24, fontWeight: '700' }}>{(getIndex() || 0) + 1}</Text>
                    <Image source={{ uri: item.cover_url }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{item.title}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 14 }} numberOfLines={1}>{item.artist_name}</Text>
                    </View>
                    <TouchableOpacity onLongPress={drag} delayLongPress={100} style={{ padding: 12, marginRight: -12 }}>
                      <Ionicons name="reorder-three" size={28} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            <TouchableOpacity style={[styles.closeModalBtn, { marginHorizontal: 20, marginBottom: 0 }]} onPress={() => setShowQueueModal(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  iconBtn: { padding: 8, width: 56, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  coverWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', width: width - 60, height: width - 60, alignSelf: 'center' },
  pulseCircle: { position: 'absolute', width: width - 70, height: width - 70, borderRadius: 1000, backgroundColor: COLORS.gold },
  vinylRecord: { width: width - 70, height: width - 70, borderRadius: (width - 70) / 2, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', elevation: 20, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, borderWidth: 1, borderColor: '#111', overflow: 'hidden' },
  platterBase: { position: 'absolute', width: width - 60, height: width - 60, borderRadius: (width - 60) / 2, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  platterDots: { position: 'absolute', width: width - 64, height: width - 64, borderRadius: (width - 64) / 2, borderWidth: 8, borderColor: '#2a2a2a', borderStyle: 'dashed' },
  vinylGroove: { position: 'absolute', borderRadius: 1000, borderWidth: 1, borderColor: '#1f1f1f' },
  vintageScratch: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 1, shadowOffset: { width: 0, height: 0 } },
  microScratch: { position: 'absolute', height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  ringWear: { position: 'absolute', width: '85%', height: '85%', top: '7.5%', left: '7.5%', borderRadius: 1000, borderWidth: 30, borderColor: 'rgba(255,255,255,0.02)', borderStyle: 'dotted' },
  vinylCenterLabel: { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', backgroundColor: '#e6d5b8', borderWidth: 4, borderColor: '#3d2b1f' },
  vinylSpindle: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#8c8c8c', borderWidth: 3, borderColor: '#111' },
  
  tonearmContainer: { position: 'absolute', top: -15, right: 5, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  tonearmBase: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2a2a', borderWidth: 2, borderColor: '#111', alignItems: 'center', justifyContent: 'center', zIndex: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 4, overflow: 'hidden' },
  tonearmStick: { position: 'absolute', top: 30, width: 10, height: 130, backgroundColor: '#ccc', zIndex: 1 },
  tonearmJoint: { position: 'absolute', top: 156, width: 16, height: 16, backgroundColor: '#555', zIndex: 2, borderRadius: 3 },
  tonearmHead: { position: 'absolute', top: 168, width: 22, height: 40, backgroundColor: '#111', borderRadius: 4, transform: [{ rotate: '22deg' }, { translateX: -8 }, { translateY: -4 }], borderWidth: 1, borderColor: '#333', overflow: 'hidden', zIndex: 3 },
  closeBtn: { marginTop: 50, marginLeft: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 16 },
  infoWrap: { flex: 1, paddingRight: 16 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  artist: { color: COLORS.gold, fontSize: 18, fontWeight: '500' },
  downloadBtn: { padding: 8 },
  progressWrap: { paddingHorizontal: 24, marginBottom: 20 },
  slider: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: -10 },
  timeText: { color: COLORS.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
  controlsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  ctrlBtn: { padding: 10 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 50 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalSub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  sleepOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider },
  sleepOptionText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  closeModalBtn: { marginTop: 24, padding: 16, borderRadius: 16, alignItems: 'center' },
  closeModalText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  playlistOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, marginBottom: 12, width: '100%', gap: 12 },
  playlistOptionText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
});
