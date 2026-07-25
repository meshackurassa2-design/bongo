import React, { useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Track } from '../constants';
import { useThemeStore } from '../store/themeStore';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  track: Track | null;
  quote?: string;
}

export default function ShareCardModal({ visible, onClose, track, quote: initialQuote }: Props) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = React.useState(false);

  const handleShare = async () => {
    if (!viewShotRef.current?.capture) return;
    
    try {
      setSharing(true);
      const uri = await viewShotRef.current.capture();
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share ${track?.title}`,
          mimeType: 'image/png',
        });
      }
    } catch (e) {
      console.error('Error sharing card:', e);
    } finally {
      setSharing(false);
      onClose(); // Optional: Close modal after sharing
    }
  };

  if (!track) return null;

  // Mock a lyric quote for demonstration if none exists, or use the provided quote
  let quote = initialQuote || "Maybe you should wish it more\nMaybe the world is yours";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Quote</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.cardContainer}>
          {/* The View to capture */}
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <View style={styles.shareCard}>
              <LinearGradient 
                colors={['#C1451F', '#B33C17']} // Vibrant Spotify-like Orange/Red
                style={StyleSheet.absoluteFillObject}
              />
              
              {/* Track Info Header */}
              <View style={styles.cardHeader}>
                <Image source={{ uri: track.cover_url }} style={styles.trackCover} />
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle}>{track.title}</Text>
                  <Text style={styles.artistName}>{track.artist_name}</Text>
                </View>
              </View>

              {/* Lyric Quote */}
              <View style={styles.quoteWrap}>
                <Text 
                  style={styles.quoteText}
                  adjustsFontSizeToFit
                  numberOfLines={5}
                >
                  {quote}
                </Text>
              </View>

              {/* Watermark / Logo */}
              <View style={styles.watermarkBox}>
                <Image source={require('../assets/images/bongo_logo.png')} style={{ width: 28, height: 28, marginRight: 8, borderRadius: 6 }} />
                <Text style={styles.watermarkText}>Bongo Stream</Text>
              </View>
            </View>
          </ViewShot>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <>
                <Ionicons name="share-social" size={22} color={COLORS.black} style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Share to Story</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  header: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  closeBtn: { padding: 8, width: 44, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCard: {
    width: width * 0.85,
    aspectRatio: 3 / 4, // Typical portrait card ratio
    borderRadius: 16,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackCover: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  artistName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  quoteWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  quoteText: {
    fontFamily: 'Outfit_900Black',
    color: '#fff',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  watermarkBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watermarkText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: width * 0.85,
    justifyContent: 'center',
  },
  shareBtnText: {
    color: COLORS.black,
    fontSize: 18,
    fontWeight: '800',
  },
});
