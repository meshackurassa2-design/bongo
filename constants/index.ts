export const THEMES = {
  luxury: {
    black: '#0A0A0F',
    darkSurface: '#12121A',
    card: '#1C1C28',
    cardAlt: '#22222E',
    gold: '#FFB830',
    goldLight: '#FFD45C',
    goldDark: '#CC8A00',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3C8',
    textTertiary: '#6B6B80',
    divider: '#2A2A38',
    error: '#FF5252',
  },
  love: {
    black: '#140A0D',
    darkSurface: '#1C0E13',
    card: '#29141B',
    cardAlt: '#361A24',
    gold: '#FF3366', // Vibrant Pink/Red
    goldLight: '#FF668D',
    goldDark: '#CC003D',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#D9B3C0',
    textTertiary: '#997A85',
    divider: '#401C27',
    error: '#FF5252',
  },
  ocean: {
    black: '#050A14',
    darkSurface: '#08101F',
    card: '#0D1A33',
    cardAlt: '#122447',
    gold: '#00E5FF', // Cyan
    goldLight: '#66EFFF',
    goldDark: '#00B3CC',
    green: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3CDE6',
    textTertiary: '#6B8EAD',
    divider: '#1A3366',
    error: '#FF5252',
  }
};

export const COLORS = THEMES.luxury;

export const GENRES = [
  { name: 'Bongo Flava', icon: 'mic', color: '#E91E63' },
  { name: 'Taarab',      icon: 'musical-notes', color: '#9C27B0' },
  { name: 'Singeli',     icon: 'flash', color: '#3F51B5' },
  { name: 'Dansi',       icon: 'people', color: '#009688' },
  { name: 'Gospel / Injili', icon: 'heart', color: '#FF5722' },
  { name: 'Afrobeats',   icon: 'earth', color: '#795548' },
  { name: 'Hip-hop',     icon: 'headset', color: '#607D8B' },
  { name: 'R&B',         icon: 'musical-note', color: '#4CAF50' },
  { name: 'Reggae',      icon: 'leaf', color: '#FF9800' },
  { name: 'Traditional', icon: 'radio', color: '#00BCD4' },
];

export type Track = {
  id: string;
  user_id: string;
  title: string;
  artist_name: string;
  genre: string;
  cover_url: string | null;
  audio_url: string;
  duration_sec: number;
  play_count: number;
  like_count: number;
  description: string | null;
  is_public: boolean;
  is_ai?: boolean;
  created_at: string;
  profile?: Profile;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: 'artist' | 'fan';
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  track_count: number;
  credits: number;
};

export type Comment = {
  id: string;
  track_id: string;
  user_id: string;
  content: string;
  timestamp_sec: number;
  created_at: string;
  profile?: Profile;
};
