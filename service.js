import TrackPlayer, { Event } from 'react-native-track-player';

import { usePlayerStore } from './store/playerStore';

export default async function() {
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteNext, () => usePlayerStore.getState().skipNext());
    TrackPlayer.addEventListener(Event.RemotePrevious, () => usePlayerStore.getState().skipPrev());
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
};
