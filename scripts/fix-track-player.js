/**
 * Postinstall script: fixes a null-safety Kotlin compile error in
 * react-native-track-player@4.1.2 that causes Android builds to fail.
 *
 * This is more robust than patch-package because it uses string matching
 * instead of line numbers, so it works regardless of minor version diffs.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-track-player',
  'android',
  'src',
  'main',
  'java',
  'com',
  'doublesymmetry',
  'trackplayer',
  'module',
  'MusicModule.kt'
);

if (!fs.existsSync(FILE)) {
  console.log('[fix-track-player] MusicModule.kt not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(FILE, 'utf8');
let changed = false;

// Fix 1: getTrack — make originalItem null-safe
const fix1From = 'callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem))';
const fix1To   = 'callback.resolve(musicService.tracks[index].originalItem?.let { Arguments.fromBundle(it) })';

if (content.includes(fix1From)) {
  content = content.replace(fix1From, fix1To);
  changed = true;
  console.log('[fix-track-player] Applied fix 1: getTrack null-safety.');
} else if (content.includes(fix1To)) {
  console.log('[fix-track-player] Fix 1 already applied, skipping.');
} else {
  console.warn('[fix-track-player] WARNING: Fix 1 target not found — the library may have changed.');
}

// Fix 2: getCurrentTrack — make originalItem null-safe
const fix2From = 'else Arguments.fromBundle(musicService.tracks[musicService.getCurrentTrackIndex()].originalItem)';
const fix2To   = 'else musicService.tracks[musicService.getCurrentTrackIndex()].originalItem?.let { Arguments.fromBundle(it) }';

if (content.includes(fix2From)) {
  content = content.replace(fix2From, fix2To);
  changed = true;
  console.log('[fix-track-player] Applied fix 2: getCurrentTrack null-safety.');
} else if (content.includes(fix2To)) {
  console.log('[fix-track-player] Fix 2 already applied, skipping.');
} else {
  console.warn('[fix-track-player] WARNING: Fix 2 target not found — the library may have changed.');
}

if (changed) {
  fs.writeFileSync(FILE, content, 'utf8');
  console.log('[fix-track-player] MusicModule.kt patched successfully.');
}
