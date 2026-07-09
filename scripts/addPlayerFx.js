const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../app/player.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add rotateAnim
content = content.replace(
  /const pulseAnim = useRef\(new Animated\.Value\(1\)\)\.current;/g,
  'const pulseAnim = useRef(new Animated.Value(1)).current;\n  const rotateAnim = useRef(new Animated.Value(0)).current;'
);

// 2. Add rotateAnim loop to useEffect
content = content.replace(
  /Animated\.timing\(pulseAnim, \{ toValue: 1, duration: 1500, easing: Easing\.inOut\(Easing\.ease\), useNativeDriver: true \}\)\n\s+\]\)\n\s+\)\.start\(\);/g,
  `Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })\n        ])\n      ).start();\n\n      Animated.loop(\n        Animated.timing(rotateAnim, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })\n      ).start();`
);

// 3. Add stopAnimation
content = content.replace(
  /pulseAnim\.stopAnimation\(\);\n\s+Animated\.spring\(scaleAnim/g,
  'pulseAnim.stopAnimation();\n      rotateAnim.stopAnimation();\n      Animated.spring(scaleAnim'
);

// 4. Add spin interpolation before return
content = content.replace(
  /return \(\n\s+<LinearGradient/g,
  `const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });\n\n  return (\n    <LinearGradient`
);

// 5. Update cover art
content = content.replace(
  /<Animated\.View style=\{\{ transform: \[\{ scale: scaleAnim \}\], borderRadius: 24, elevation: 20, shadowColor: COLORS\.gold, shadowOffset: \{ width: 0, height: 10 \}, shadowOpacity: 0\.3, shadowRadius: 20 \}\}>/g,
  `<Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: spin }], borderRadius: 160, elevation: 20, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, overflow: 'hidden', borderWidth: 4, borderColor: COLORS.darkSurface }}>`
);

content = content.replace(
  /<\/View>\n\s+<\/Animated\.View>\n\s+<\/View>/g,
  `</View>\n          )}\n          <View style={{ position: 'absolute', top: '50%', left: '50%', width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.black, transform: [{ translateX: -16 }, { translateY: -16 }], borderWidth: 2, borderColor: COLORS.card }} />\n        </Animated.View>\n      </View>\n\n      <View style={{ alignItems: 'center' }}>\n        <Visualizer isPlaying={isPlaying} />\n      </View>`
);


// 6. Add Visualizer component and adjust styles
content = content.replace(
  /} \n\nconst getStyles = \(COLORS: any\) => StyleSheet\.create\(\{/g,
  `} \n\nfunction Visualizer({ isPlaying }: { isPlaying: boolean }) {\n  return (\n    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 40, marginTop: 24, marginBottom: 8 }}>\n      {[0, 1, 2, 3, 4, 5, 6].map((i) => <VisBar key={i} delay={i * 150} isPlaying={isPlaying} />)}\n    </View>\n  );\n}\n\nfunction VisBar({ delay, isPlaying }: { delay: number, isPlaying: boolean }) {\n  const { COLORS } = useThemeStore();\n  const heightAnim = useRef(new Animated.Value(10)).current;\n\n  useEffect(() => {\n    let isActive = true;\n    const startAnim = () => {\n      if (!isActive) return;\n      Animated.sequence([\n        Animated.delay(delay),\n        Animated.timing(heightAnim, { toValue: Math.random() * 30 + 10, duration: 250, useNativeDriver: false }),\n        Animated.timing(heightAnim, { toValue: Math.random() * 15 + 5, duration: 250, useNativeDriver: false })\n      ]).start(({ finished }) => {\n        if (finished && isActive && isPlaying) startAnim();\n      });\n    };\n\n    if (isPlaying) {\n      startAnim();\n    } else {\n      isActive = false;\n      heightAnim.stopAnimation();\n      Animated.spring(heightAnim, { toValue: 4, useNativeDriver: false }).start();\n    }\n    \n    return () => { isActive = false; };\n  }, [isPlaying, delay]);\n\n  return <Animated.View style={{ width: 6, height: heightAnim, backgroundColor: COLORS.gold, borderRadius: 3 }} />;\n}\n\nconst getStyles = (COLORS: any) => StyleSheet.create({`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Player updated');
