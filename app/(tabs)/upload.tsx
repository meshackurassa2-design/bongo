import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator
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

type EPTrack = {
  title: string;
  collaborator: string;
  audioFile: { uri: string; name: string; mimeType: string } | null;
  lyricsSwahili: string;
  lyricsEnglish: string;
};

export default function UploadScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);

  const [uploadMode, setUploadMode] = useState<'single' | 'ep'>('single');

  // Single Track State
  const [title, setTitle] = useState('');
  const [collaborator, setCollaborator] = useState('');
  const [description, setDescription] = useState('');
  const [lyricsSwahili, setLyricsSwahili] = useState('');
  const [lyricsEnglish, setLyricsEnglish] = useState('');
  const [audioFile, setAudioFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);

  // EP / Album State
  const [epTitle, setEpTitle] = useState('');
  const [epDescription, setEpDescription] = useState('');
  const [epTracks, setEpTracks] = useState<EPTrack[]>([
    { title: '', collaborator: '', audioFile: null, lyricsSwahili: '', lyricsEnglish: '' }
  ]);

  // Shared State
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState('Bongo Flava');
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  if (!session) {
    return (
      <View style={styles.noAuth}>
        <Ionicons name="lock-closed" size={64} color={COLORS.textSecondary} />
        <Text style={styles.noAuthTitle}>Artist Account Required</Text>
        <Text style={styles.noAuthText}>You must log in to upload tracks</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth')}>
          <Text style={styles.loginBtnText}>Log In / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const pickSingleAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      setAudioFile({ uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType ?? 'audio/mpeg' });
    }
  };

  const pickEPTrackAudio = async (index: number) => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const newTracks = [...epTracks];
      newTracks[index].audioFile = { uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType ?? 'audio/mpeg' };
      setEpTracks(newTracks);
    }
  };

  const addEPTrack = () => {
    setEpTracks([...epTracks, { title: '', collaborator: '', audioFile: null, lyricsSwahili: '', lyricsEnglish: '' }]);
  };

  const removeEPTrack = (index: number) => {
    const newTracks = [...epTracks];
    newTracks.splice(index, 1);
    setEpTracks(newTracks);
  };

  const uploadCoverToStorage = async (userId: string) => {
    if (!coverUri) return null;
    const coverBase64 = await FileSystem.readAsStringAsync(coverUri, { encoding: 'base64' });
    const coverFileName = `${userId}/cover_${Date.now()}.jpg`;
    const { error: coverError } = await supabase.storage.from('covers').upload(
      coverFileName,
      decode(coverBase64),
      { contentType: 'image/jpeg', upsert: false }
    );
    if (!coverError) {
      const { data } = supabase.storage.from('covers').getPublicUrl(coverFileName);
      return data.publicUrl;
    }
    return null;
  };

  const uploadSingle = async () => {
    const mainArtist = profile?.display_name ?? 'Unknown Artist';
    if (!title.trim() || !audioFile || !coverUri) {
      Alert.alert('Error', 'Please fill all required fields and add a cover image.');
      return;
    }

    setUploading(true);
    setProgress(0.2);
    setProgressLabel('Uploading cover image...');

    try {
      const userId = session.user.id;
      const coverUrl = await uploadCoverToStorage(userId);

      setProgress(0.5);
      setProgressLabel('Uploading audio file...');
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
      
      setProgress(0.9);
      setProgressLabel('Saving track details...');
      const finalArtistName = collaborator.trim() ? `${mainArtist}, ${collaborator.trim()}` : mainArtist;
      const { error: dbError } = await supabase.from('tracks').insert({
        user_id: userId,
        title: title.trim(),
        artist_name: finalArtistName,
        genre: selectedGenre,
        audio_url: audioData.publicUrl,
        cover_url: coverUrl,
        description: description.trim() || null,
        lyrics_swahili: lyricsSwahili.trim() || null,
        lyrics_english: lyricsEnglish.trim() || null,
        is_public: true,
        duration_sec: 0,
        copyright_cleared: true,
      });
      if (dbError) throw dbError;

      setProgress(1);
      setProgressLabel('Success!');
      Alert.alert('Success!', 'Your track has been uploaded!', [
        { text: 'OK', onPress: () => { resetForm(); router.replace('/'); } }
      ]);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const uploadEP = async () => {
    const mainArtist = profile?.display_name ?? 'Unknown Artist';
    if (!epTitle.trim() || !coverUri) {
      Alert.alert('Error', 'Please provide an EP title and cover image.');
      return;
    }

    const invalidTracks = epTracks.filter(t => !t.title.trim() || !t.audioFile);
    if (invalidTracks.length > 0) {
      Alert.alert('Error', 'Please provide a title and audio file for all EP tracks.');
      return;
    }

    setUploading(true);
    setProgress(0.1);
    setProgressLabel('Uploading EP cover image...');

    try {
      const userId = session.user.id;
      const coverUrl = await uploadCoverToStorage(userId);

      // Create playlist for EP
      setProgress(0.2);
      setProgressLabel('Creating EP...');
      const { data: playlistData, error: playlistError } = await supabase.from('playlists').insert({
        user_id: userId,
        title: epTitle.trim(),
        description: epDescription.trim() || null,
        cover_url: coverUrl,
        is_public: true,
      }).select('id').single();

      if (playlistError) throw playlistError;
      const playlistId = playlistData.id;

      // Upload tracks sequentially
      for (let i = 0; i < epTracks.length; i++) {
        const track = epTracks[i];
        setProgress(0.2 + ((i + 1) / epTracks.length) * 0.6);
        setProgressLabel(`Uploading track ${i + 1} of ${epTracks.length}...`);

        const audioBase64 = await FileSystem.readAsStringAsync(track.audioFile!.uri, { encoding: 'base64' });
        const ext = track.audioFile!.name.split('.').pop() ?? 'mp3';
        const audioFileName = `${userId}/audio_${Date.now()}_${i}.${ext}`;
        
        const { error: audioError } = await supabase.storage.from('audio').upload(
          audioFileName,
          decode(audioBase64),
          { contentType: track.audioFile!.mimeType, upsert: false }
        );
        if (audioError) throw audioError;

        const { data: audioData } = supabase.storage.from('audio').getPublicUrl(audioFileName);
        const finalArtistName = track.collaborator.trim() ? `${mainArtist}, ${track.collaborator.trim()}` : mainArtist;

        const { data: insertedTrack, error: dbError } = await supabase.from('tracks').insert({
          user_id: userId,
          title: track.title.trim(),
          artist_name: finalArtistName,
          genre: selectedGenre, // Use EP genre for all tracks
          audio_url: audioData.publicUrl,
          cover_url: coverUrl, // Use EP cover for all tracks
          description: epDescription.trim() || null,
          lyrics_swahili: track.lyricsSwahili.trim() || null,
          lyrics_english: track.lyricsEnglish.trim() || null,
          is_public: true,
          duration_sec: 0,
          copyright_cleared: true,
        }).select('id').single();

        if (dbError) throw dbError;

        // Link track to playlist
        await supabase.from('playlist_tracks').insert({
          playlist_id: playlistId,
          track_id: insertedTrack.id,
        });
      }

      setProgress(1);
      setProgressLabel('Success!');
      Alert.alert('Success!', 'Your EP has been uploaded!', [
        { text: 'OK', onPress: () => { resetForm(); router.replace('/'); } }
      ]);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setCollaborator(''); setDescription(''); setLyricsSwahili(''); setLyricsEnglish('');
    setAudioFile(null); setCoverUri(null);
    setEpTitle(''); setEpDescription(''); setEpTracks([{ title: '', collaborator: '', audioFile: null, lyricsSwahili: '', lyricsEnglish: '' }]);
  };

  const handleUpload = () => {
    if (uploadMode === 'single') uploadSingle();
    else uploadEP();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Upload Music</Text>
      <Text style={styles.subtitle}>Share your music with Tanzania!</Text>

      {/* Mode Switcher */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity 
          style={[styles.modeBtn, uploadMode === 'single' && styles.modeBtnActive]} 
          onPress={() => setUploadMode('single')}
        >
          <Text style={[styles.modeBtnText, uploadMode === 'single' && styles.modeBtnTextActive]}>Single Track</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modeBtn, uploadMode === 'ep' && styles.modeBtnActive]} 
          onPress={() => setUploadMode('ep')}
        >
          <Text style={[styles.modeBtnText, uploadMode === 'ep' && styles.modeBtnTextActive]}>EP / Album</Text>
        </TouchableOpacity>
      </View>

      {/* Cover art picker */}
      <Text style={styles.fieldLabel}>{uploadMode === 'single' ? 'Track Cover Art *' : 'EP / Album Cover Art *'}</Text>
      <TouchableOpacity style={styles.coverPicker} onPress={pickCover}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.coverImage} transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={48} color={COLORS.gold} />
            <Text style={styles.coverHint}>Tap to add cover image</Text>
          </View>
        )}
        {coverUri && (
          <View style={styles.coverEditOverlay}>
            <Ionicons name="pencil" size={24} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Genre picker (Shared) */}
      <Text style={styles.fieldLabel}>Music Genre</Text>
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

      {/* Single Mode Form */}
      {uploadMode === 'single' && (
        <View style={{ marginTop: 20 }}>
          <BongoInput styles={styles} COLORS={COLORS} label="Track Title *" value={title} onChangeText={setTitle} placeholder="Enter track title..." />
          <BongoInput styles={styles} COLORS={COLORS} label="Collaborator (Optional)" value={collaborator} onChangeText={setCollaborator} placeholder="e.g. Diamond Platnumz" />
          <BongoInput styles={styles} COLORS={COLORS} label="Description (Optional)" value={description} onChangeText={setDescription} placeholder="Short description..." multiline />
          
          <TouchableOpacity style={[styles.audioPicker, audioFile && styles.audioPickerSelected]} onPress={pickSingleAudio}>
            <Ionicons name={audioFile ? 'musical-notes' : 'cloud-upload-outline'} size={28} color={audioFile ? COLORS.gold : COLORS.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.audioPickerTitle, audioFile && { color: COLORS.gold }]}>
                {audioFile ? 'Audio Selected' : 'Select Audio File *'}
              </Text>
              <Text style={styles.audioPickerHint}>
                {audioFile ? audioFile.name : 'MP3, WAV, FLAC supported'}
              </Text>
            </View>
          </TouchableOpacity>

          <BongoInput styles={styles} COLORS={COLORS} label="Lyrics Swahili (Optional)" value={lyricsSwahili} onChangeText={setLyricsSwahili} placeholder="Enter lyrics..." multiline />
          <BongoInput styles={styles} COLORS={COLORS} label="Lyrics English (Optional)" value={lyricsEnglish} onChangeText={setLyricsEnglish} placeholder="Enter lyrics..." multiline />
        </View>
      )}

      {/* EP Mode Form */}
      {uploadMode === 'ep' && (
        <View style={{ marginTop: 20 }}>
          <BongoInput styles={styles} COLORS={COLORS} label="EP / Album Title *" value={epTitle} onChangeText={setEpTitle} placeholder="Enter EP title..." />
          <BongoInput styles={styles} COLORS={COLORS} label="EP Description (Optional)" value={epDescription} onChangeText={setEpDescription} placeholder="Short description..." multiline />
          
          <Text style={[styles.fieldLabel, { marginTop: 24, fontSize: 16, color: COLORS.textPrimary }]}>Tracks *</Text>
          {epTracks.map((track, index) => (
            <View key={index} style={styles.epTrackContainer}>
              <View style={styles.epTrackHeader}>
                <Text style={styles.epTrackTitle}>Track {index + 1}</Text>
                {epTracks.length > 1 && (
                  <TouchableOpacity onPress={() => removeEPTrack(index)}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.input, { marginBottom: 12 }]}
                value={track.title}
                onChangeText={(text) => {
                  const newTracks = [...epTracks];
                  newTracks[index].title = text;
                  setEpTracks(newTracks);
                }}
                placeholder="Track Title *"
                placeholderTextColor={COLORS.textTertiary}
              />

              <TouchableOpacity style={[styles.audioPicker, track.audioFile && styles.audioPickerSelected]} onPress={() => pickEPTrackAudio(index)}>
                <Ionicons name={track.audioFile ? 'musical-notes' : 'cloud-upload-outline'} size={24} color={track.audioFile ? COLORS.gold : COLORS.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.audioPickerTitle, track.audioFile && { color: COLORS.gold }]}>
                    {track.audioFile ? track.audioFile.name : 'Select Audio File *'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addTrackBtn} onPress={addEPTrack}>
            <Ionicons name="add" size={20} color={COLORS.gold} />
            <Text style={styles.addTrackBtnText}>Add Another Track</Text>
          </TouchableOpacity>
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
        style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading
          ? <ActivityIndicator size="small" color={COLORS.black} />
          : <Ionicons name="cloud-upload" size={20} color={COLORS.black} />
        }
        <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : `Upload ${uploadMode === 'ep' ? 'EP' : 'Track'}`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function BongoInput({ label, value, onChangeText, placeholder, multiline, styles, COLORS }: { label: string; value: string; onChangeText: (t: string) => void; placeholder: string; multiline?: boolean; styles: any; COLORS: any }) {
  return (
    <View style={{ marginBottom: 16 }}>
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
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  modeSwitcher: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 20 },
  modeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: COLORS.cardAlt },
  modeBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  modeBtnTextActive: { color: COLORS.gold },
  coverPicker: { width: '100%', height: 180, borderRadius: 16, borderWidth: 2, borderColor: COLORS.divider, backgroundColor: COLORS.card, overflow: 'hidden', marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { alignItems: 'center' },
  coverHint: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  coverEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  audioPicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 2, borderColor: COLORS.divider, padding: 14, gap: 12, marginBottom: 12 },
  audioPickerSelected: { borderColor: COLORS.gold },
  audioPickerTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  audioPickerHint: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, color: COLORS.textPrimary, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  genreSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12 },
  genreValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500' },
  genreDropdown: { backgroundColor: COLORS.cardAlt, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, marginTop: -8, marginBottom: 12, overflow: 'hidden' },
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
  epTrackContainer: { backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.divider },
  epTrackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  epTrackTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  addTrackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: COLORS.gold, borderStyle: 'dashed', borderRadius: 12, marginBottom: 20 },
  addTrackBtnText: { color: COLORS.gold, fontSize: 14, fontWeight: '600' }
});
