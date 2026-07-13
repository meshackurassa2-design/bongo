import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
  
  // We need to defer the import of zustand store to avoid circular deps during background init
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const { usePlayerStore } = require('./store/playerStore');
    await usePlayerStore.getState().skipNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const { usePlayerStore } = require('./store/playerStore');
    await usePlayerStore.getState().skipPrev();
  });
};
