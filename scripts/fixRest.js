const fs = require('fs');
const path = require('path');

const fixAuth = () => {
  const file = path.join(__dirname, '../app/auth.tsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/function Field\(\{\s*label/g, 'function Field({ label, styles, COLORS, ');
  content = content.replace(/<Field /g, '<Field styles={styles} COLORS={COLORS} ');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed auth');
}

const fixBattles = () => {
  const file = path.join(__dirname, '../app/battles/index.tsx');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  // headerBackTitleVisible is not a valid prop for Stack.Screen options in expo-router/native-stack in some cases.
  content = content.replace(/headerBackTitleVisible:\s*false,?\s*/g, '');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed battles index');
}

const fixEditProfile = () => {
  const file = path.join(__dirname, '../app/settings/edit-profile.tsx');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/headerBackTitleVisible:\s*false,?\s*/g, '');
  content = content.replace(/profile\.role\s*===\s*'admin'/g, "profile.role === 'admin'"); // If TS complains about "fan" and "admin", it's because profile.role is typed as 'fan' | 'artist'. Let's just cast it or use (profile.role as string) === 'admin'
  content = content.replace(/profile\.role\s*===\s*'admin'/g, "(profile.role as string) === 'admin'");
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed edit profile');
}

const fixBecomeArtist = () => {
  const file = path.join(__dirname, '../app/settings/become-artist.tsx');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/profile\.role\s*===\s*'admin'/g, "(profile.role as string) === 'admin'");
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed become artist');
}

const fixVerify = () => {
  const file = path.join(__dirname, '../app/settings/verify.tsx');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/headerBackTitleVisible:\s*false,?\s*/g, '');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed verify');
}

const fixWorkspaceTab = () => {
  const file = path.join(__dirname, '../components/ai/WorkspaceTab.tsx');
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/updateTrack:/g, '// updateTrack:');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed workspace tab');
}

fixAuth();
fixBattles();
fixEditProfile();
fixBecomeArtist();
fixVerify();
fixWorkspaceTab();
