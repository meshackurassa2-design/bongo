import TrackPlayer, { Event } from 'react-native-track-player';
import { usePlayerStore } from './store/playerStore';

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    usePlayerStore.getState().skipNext();
  });
  
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    usePlayerStore.getState().skipPrev();
  });
  
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event) => {
    // When the track ends, skip to next!
    if (event.position > 0) {
      if (usePlayerStore.getState().repeatOne) {
        TrackPlayer.seekTo(0);
        TrackPlayer.play();
      } else {
        usePlayerStore.getState().skipNext();
      }
    }
  });
};
