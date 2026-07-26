import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function() {
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteNext, () => {
        const { usePlayerStore } = require('./store/playerStore');
        usePlayerStore.getState().skipNext();
    });
    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
        const { usePlayerStore } = require('./store/playerStore');
        usePlayerStore.getState().skipPrev();
    });
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
};
