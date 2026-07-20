import { Stack, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoadTripLayout() {
  const { COLORS } = useThemeStore();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.black },
        headerTintColor: COLORS.textPrimary,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 20 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="host" options={{ title: 'Host Road Trip' }} />
      <Stack.Screen name="join" options={{ title: 'Join Road Trip' }} />
      <Stack.Screen name="shared-queue" options={{ title: 'Road Trip Queue' }} />
    </Stack>
  );
}
