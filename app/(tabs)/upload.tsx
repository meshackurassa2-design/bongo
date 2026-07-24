import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { GENRES } from '../../constants';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export default function UploadScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);

  const [title, setTitle] = useState('');
  const [collaborator, setCollaborator] = useState('');
  const [description, setDescription] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0].name);
  const [audioFile, setAudioFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [showGenrePicker, setShowGenrePicker] = useState(false);

  if (!session) {
    return (
      <View style={styles.noAuth}>
        <Ionicons name="lock-closed" size={64} color={COLORS.textSecondary} />
        <Text style={styles.noAuthTitle}>Akaunti ya Msanii Inahitajika</Text>
        <Text style={styles.noAuthText}>Lazima uingie ili kupakia nyimbo</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth')}>
          <Text style={styles.loginBtnText}>Ingia / Jisajili</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      setAudioFile({ uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType ?? 'audio/mpeg' });
    }
  };

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const upload = async () => {
    const mainArtist = profile?.display_name ?? 'Unknown Artist';
    
    if (!title.trim() || !audioFile || !coverUri) {
      Alert.alert('Kosa', 'Tafadhali jaza sehemu zote, na picha ya jalada (thumbnail) ni lazima.');
      return;
    }
    setUploading(true);
    setProgress(0.1);
    setProgressLabel('Inaandaa...');

    try {
      const userId = session.user.id;

      // Upload cover
      let coverUrl: string | null = null;
      if (coverUri) {
        setProgress(0.2); setProgressLabel('Inapakia picha ya jalada...');
        const coverBase64 = await FileSystem.readAsStringAsync(coverUri, { encoding: 'base64' });
        const coverFileName = `${userId}/cover_${Date.now()}.jpg`;
        const { error: coverError } = await supabase.storage.from('covers').upload(
          coverFileName,
          decode(coverBase64),
          { contentType: 'image/jpeg', upsert: false }
        );
        if (!coverError) {
          const { data } = supabase.storage.from('covers').getPublicUrl(coverFileName);
          coverUrl = data.publicUrl;
        }
      }

      // Upload audio
      setProgress(0.5); setProgressLabel('Inapakia muziki...');
      const audioBase64 = await FileSystem.readAsStringAsync(audioFile.uri, { encoding: 'base64' });
      const ext = audioFile.name.split('.').pop() ?? 'mp3';
      const audioFileName = `${userId}/audio_${Date.now()}.${ext}`;
      const { error: audioError } = await supabase.storage.from('audio').upload(
        audioFileName,
        decode(audioBase64),
        { contentType: audioFile.mimeType, upsert: false }
      );
      if (audioError) throw audioError;

      const { data: audioData } = supabase.storage.from('audio').getPublicUrl(audioFileName);
      const audioUrl = audioData.publicUrl;

      // Save to DB
      setProgress(0.9); setProgressLabel('Inahifadhi...');
      const finalArtistName = collaborator.trim() ? `${mainArtist}, ${collaborator.trim()}` : mainArtist;
      const { error: dbError } = await supabase.from('tracks').insert({
        user_id: userId,
        title: title.trim(),
        artist_name: finalArtistName,
        genre: selectedGenre,
        audio_url: audioUrl,
        cover_url: coverUrl,
        description: description.trim() || null,
        lyrics: lyricsText.trim() || null,
        is_public: true,
        duration_sec: 0,
      });
      if (dbError) throw dbError;

      setProgress(1); setProgressLabel('Imefanikiwa!');
      Alert.alert('Hongera!', 'Wimbo wako umepakiwa!', [
        { text: 'Sawa', onPress: () => { setTitle(''); setCollaborator(''); setDescription(''); setLyricsText(''); setAudioFile(null); setCoverUri(null); setUploading(false); router.replace('/'); } }
      ]);
    } catch (e: any) {
      Alert.alert('Imeshindwa', e.message ?? 'Jaribu tena');
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Pakia Wimbo</Text>
      <Text style={styles.subtitle}>Shiriki muziki wako na Tanzania!</Text>

      {/* Cover art picker */}
      <TouchableOpacity style={styles.coverPicker} onPress={pickCover}>
        {coverUri
          ? <Image source={{ uri: coverUri }} style={styles.coverImage} transition={200} cachePolicy="memory-disk" />
          : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={48} color={COLORS.gold} />
              <Text style={styles.coverHint}>Bonyeza kuongeza picha ya jalada</Text>
              <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginTop: 4 }}>(Hiari)</Text>
            </View>
          )
        }
        {coverUri && (
          <View style={styles.coverEditOverlay}>
            <Ionicons name="pencil" size={24} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Audio file picker */}
      <TouchableOpacity style={[styles.audioPicker, audioFile && styles.audioPickerSelected]} onPress={pickAudio}>
        <Ionicons name={audioFile ? 'musical-notes' : 'cloud-upload-outline'} size={28} color={audioFile ? COLORS.gold : COLORS.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.audioPickerTitle, audioFile && { color: COLORS.gold }]}>
            {audioFile ? 'Faili Limechaguliwa' : 'Chagua Faili la Sauti *'}
          </Text>
          <Text style={styles.audioPickerHint}>
            {audioFile ? audioFile.name : 'MP3, WAV, FLAC zinakubaliwa'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
      </TouchableOpacity>

      {/* Form fields */}
      <BongoInput styles={styles} COLORS={COLORS} label="Jina la Wimbo *" value={title} onChangeText={setTitle} placeholder="Andika jina la wimbo..." />
      
      <View>
        <Text style={styles.fieldLabel}>Msanii Mkuu *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: COLORS.cardAlt, color: COLORS.textSecondary }]}
          value={profile?.display_name ?? ''}
          editable={false}
        />
      </View>
      
      <BongoInput styles={styles} COLORS={COLORS} label="Mshirikishi (Collabo) (Hiari)" value={collaborator} onChangeText={setCollaborator} placeholder="Mfn. Diamond Platnumz" />
      
      <BongoInput styles={styles} COLORS={COLORS} label="Maelezo (Hiari)" value={description} onChangeText={setDescription} placeholder="Maelezo mafupi..." multiline />
      
      <BongoInput styles={styles} COLORS={COLORS} label="Synced Lyrics (LRC) (Hiari)" value={lyricsText} onChangeText={setLyricsText} placeholder="[00:15.50] Mstari wa kwanza..." multiline />

      {/* Genre picker */}
      <Text style={styles.fieldLabel}>Aina ya Muziki</Text>
      <TouchableOpacity style={styles.genreSelector} onPress={() => setShowGenrePicker(!showGenrePicker)}>
        <Text style={styles.genreValue}>{GENRES.find(g => g.name === selectedGenre)?.emoji} {selectedGenre}</Text>
        <Ionicons name={showGenrePicker ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {showGenrePicker && (
        <View style={styles.genreDropdown}>
          {GENRES.map(g => (
            <TouchableOpacity
              key={g.name}
              style={[styles.genreOption, selectedGenre === g.name && styles.genreOptionSelected]}
              onPress={() => { setSelectedGenre(g.name); setShowGenrePicker(false); }}
            >
              <Text style={styles.genreOptionText}>{g.emoji} {g.name}</Text>
              {selectedGenre === g.name && <Ionicons name="checkmark" size={16} color={COLORS.gold} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Progress */}
      {uploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progressLabel}</Text>
        </View>
      )}

      {/* Upload button */}
      <TouchableOpacity
        style={[styles.uploadBtn, (uploading || !title || !audioFile) && styles.uploadBtnDisabled]}
        onPress={upload}
        disabled={uploading || !title.trim() || !audioFile}
      >
        {uploading
          ? <ActivityIndicator size="small" color={COLORS.black} />
          : <Ionicons name="cloud-upload" size={20} color={COLORS.black} />
        }
        <Text style={styles.uploadBtnText}>{uploading ? 'Inapakia...' : 'Pakia Wimbo'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BongoInput({ label, value, onChangeText, placeholder, multiline, styles, COLORS }: { label: string; value: string; onChangeText: (t: string) => void; placeholder: string; multiline?: boolean; styles: any; COLORS: any }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingHorizontal: 16, paddingTop: 60 },
  title: { color: COLORS.gold, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  coverPicker: { width: '100%', height: 180, borderRadius: 16, borderWidth: 2, borderColor: COLORS.divider, backgroundColor: COLORS.card, overflow: 'hidden', marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center' },
  coverHint: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  coverEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  audioPicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 2, borderColor: COLORS.divider, padding: 14, gap: 12, marginBottom: 12 },
  audioPickerSelected: { borderColor: COLORS.gold },
  audioPickerTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  audioPickerHint: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, color: COLORS.textPrimary, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  genreSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, paddingHorizontal: 14, paddingVertical: 14 },
  genreValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500' },
  genreDropdown: { backgroundColor: COLORS.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, marginTop: 4, overflow: 'hidden' },
  genreOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  genreOptionSelected: { backgroundColor: COLORS.gold + '20' },
  genreOptionText: { color: COLORS.textPrimary, fontSize: 14 },
  progressContainer: { marginTop: 16 },
  progressBar: { height: 4, backgroundColor: COLORS.divider, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: COLORS.gold, borderRadius: 2 },
  progressLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold, borderRadius: 12, padding: 16, marginTop: 20, gap: 8 },
  uploadBtnDisabled: { backgroundColor: COLORS.divider },
  uploadBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  noAuth: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAuthTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  noAuthText: { color: COLORS.textSecondary, fontSize: 14 },
  loginBtn: { backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  loginBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
});
