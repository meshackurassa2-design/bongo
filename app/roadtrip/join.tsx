import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../../store/themeStore';
import { useRoadTripStore } from '../../store/roadTripStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function JoinScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { joinRoadTrip } = useRoadTripStore();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleJoin = async (code: string) => {
    if (!code || joining) return;
    setJoining(true);
    
    const success = await joinRoadTrip(code);
    setJoining(false);
    
    if (success) {
      router.replace('/roadtrip/shared-queue');
    } else {
      setScanned(false);
      Alert.alert('Error', 'Invalid code or the Road Trip has ended.');
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Road Trip</Text>
      
      {permission.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView 
            style={styles.camera} 
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : ({ data }) => {
              setScanned(true);
              handleJoin(data);
            }}
          />
          <View style={styles.overlay}>
             <View style={styles.scanBox} />
          </View>
        </View>
      ) : (
        <View style={styles.noCamera}>
           <Text style={{ color: COLORS.textSecondary }}>Camera access is required to scan QR codes.</Text>
           <TouchableOpacity style={{ marginTop: 12 }} onPress={requestPermission}>
             <Text style={{ color: COLORS.gold }}>Grant Permission</Text>
           </TouchableOpacity>
        </View>
      )}

      <Text style={styles.orText}>OR ENTER CODE MANUALLY</Text>

      <View style={styles.inputRow}>
        <TextInput 
          style={styles.input}
          placeholder="e.g. ABCD"
          placeholderTextColor={COLORS.textTertiary}
          value={manualCode}
          onChangeText={setManualCode}
          autoCapitalize="characters"
          maxLength={4}
        />
        <TouchableOpacity 
          style={[styles.joinBtn, (!manualCode || joining) && { opacity: 0.5 }]} 
          onPress={() => handleJoin(manualCode)}
          disabled={!manualCode || joining}
        >
          {joining ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.joinBtnText}>Join</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, alignItems: 'center', padding: 24 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 24 },
  cameraWrap: { width: 280, height: 280, borderRadius: 24, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanBox: { width: 200, height: 200, borderWidth: 2, borderColor: COLORS.gold, borderRadius: 16, backgroundColor: 'transparent' },
  noCamera: { width: 280, height: 280, borderRadius: 24, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', padding: 20 },
  orText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginVertical: 32 },
  inputRow: { flexDirection: 'row', width: '100%', gap: 12 },
  input: { flex: 1, backgroundColor: COLORS.cardAlt, color: COLORS.textPrimary, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 12, fontSize: 18, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
  joinBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  joinBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
});
