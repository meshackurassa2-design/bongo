const fs = require('fs');

let file1 = 'node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt';
let code1 = fs.readFileSync(file1, 'utf-8');

code1 = code1.replace(
    "callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem))",
    "val item = musicService.tracks[index].originalItem\n            callback.resolve(if (item != null) Arguments.fromBundle(item) else null)"
);

let getActiveTrackOld = `callback.resolve(
            if (musicService.tracks.isEmpty()) null
            else Arguments.fromBundle(
                musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
            )
        )`;

let getActiveTrackNew = `if (musicService.tracks.isEmpty()) {
            callback.resolve(null)
        } else {
            val item = musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
            callback.resolve(if (item != null) Arguments.fromBundle(item) else null)
        }`;

code1 = code1.replace(getActiveTrackOld, getActiveTrackNew);
fs.writeFileSync(file1, code1, 'utf-8');

let file2 = 'node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/service/MusicService.kt';
let code2 = fs.readFileSync(file2, 'utf-8');
code2 = code2.replace("override fun onBind(intent: Intent?): IBinder {", "override fun onBind(intent: Intent): IBinder? {");
fs.writeFileSync(file2, code2, 'utf-8');
