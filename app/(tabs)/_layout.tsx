import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { COLORS } from '../../constants';
import MiniPlayer from '../../components/MiniPlayer';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

function TabBarIcon({ name, color }: { name: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const profile = useAuthStore(s => s.profile);

  return (
    <View style={styles.container}>
      <Tabs
        sceneContainerStyle={{ backgroundColor: COLORS.black }}
        tabBar={(props) => (
          <View>
            {currentTrack && <MiniPlayer />}
            <BottomTabBar {...props} />
          </View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.gold,
          tabBarInactiveTintColor: COLORS.textTertiary,
          tabBarLabelStyle: styles.label,
          tabBarShowLabel: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: t('tabs.search'),
            tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
          }}
        />
        <Tabs.Screen
          name="ai-studio"
          options={{
            title: "AI Studio",
            tabBarIcon: ({ color }) => <TabBarIcon name="color-wand" color={color} />,
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: t('tabs.upload'),
            href: ((profile?.role as any) === 'artist' || (profile?.role as any) === 'admin') ? '/upload' : null,
            tabBarIcon: ({ color }) => <Ionicons name="cloud-upload" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color }) => <TabBarIcon name="library" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color }) => <TabBarIcon name="person" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  tabBar: {
    backgroundColor: COLORS.darkSurface,
    borderTopColor: COLORS.divider,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
