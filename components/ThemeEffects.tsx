import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';

const { width, height } = Dimensions.get('window');

// ----------------------------------------------------
// Love Hearts (Floating up and swaying)
// ----------------------------------------------------
function HeartBubble({ delay }: { delay: number }) {
  const { COLORS } = useThemeStore();
  const translateY = useRef(new Animated.Value(height + 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  
  const startX = useRef(Math.random() * width).current;
  const size = useRef(Math.random() * 20 + 20).current;
  const swayAmount = useRef(Math.random() * 40 - 20).current;

  useEffect(() => {
    let isActive = true;
    const startAnimation = () => {
      if (!isActive) return;
      translateY.setValue(height + 100);
      opacity.setValue(0);
      scale.setValue(0.5);
      translateX.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
            Animated.delay(3000),
            Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
          ]),
          Animated.timing(scale, { toValue: 1.2 + Math.random() * 0.5, duration: 6000, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: swayAmount, duration: 6000, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -100, duration: 6000 + Math.random() * 2000, useNativeDriver: true }),
        ])
      ]).start(({ finished }) => { if (finished && isActive) startAnimation(); });
    };

    startAnimation();
    return () => { isActive = false; };
  }, [delay, swayAmount]);

  return (
    <Animated.View style={[styles.particle, { left: startX, transform: [{ translateY }, { translateX }, { scale }], opacity }]}>
      <Ionicons name="heart" size={size} color={COLORS.gold} />
    </Animated.View>
  );
}

// ----------------------------------------------------
// Forest Leaves (Falling slowly down)
// ----------------------------------------------------
function FallingLeaf({ delay }: { delay: number }) {
  const { COLORS } = useThemeStore();
  const translateY = useRef(new Animated.Value(-100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const startX = useRef(Math.random() * width).current;
  const swayEnd = useRef(Math.random() * 100 - 50).current;

  useEffect(() => {
    let isActive = true;
    const startAnimation = () => {
      if (!isActive) return;
      translateY.setValue(-100);
      translateX.setValue(0);
      rotate.setValue(0);
      opacity.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: height + 100, duration: 8000 + Math.random() * 4000, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: swayEnd, duration: 8000 + Math.random() * 4000, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 1, duration: 8000 + Math.random() * 4000, useNativeDriver: true })
        ])
      ]).start(({ finished }) => { if (finished && isActive) startAnimation(); });
    };

    startAnimation();
    return () => { isActive = false; };
  }, [delay, swayEnd]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.particle, { left: startX, transform: [{ translateY }, { translateX }, { rotate: spin }], opacity }]}>
      <Ionicons name="leaf" size={16} color={COLORS.gold} />
    </Animated.View>
  );
}

// ----------------------------------------------------
// Cyberpunk Particles (Fast floating neon)
// ----------------------------------------------------
function NeonParticle({ delay }: { delay: number }) {
  const { COLORS } = useThemeStore();
  const translateY = useRef(new Animated.Value(height + 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  const startX = useRef(Math.random() * width).current;
  const size = useRef(Math.random() * 4 + 2).current;
  const isCyan = useRef(Math.random() > 0.5).current;

  useEffect(() => {
    let isActive = true;
    const startAnimation = () => {
      if (!isActive) return;
      translateY.setValue(height + 100);
      opacity.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.8, duration: 500, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.timing(translateY, { toValue: -100, duration: 3000 + Math.random() * 1500, useNativeDriver: true }),
        ])
      ]).start(({ finished }) => { if (finished && isActive) startAnimation(); });
    };

    startAnimation();
    return () => { isActive = false; };
  }, [delay]);

  return (
    <Animated.View style={[styles.particle, { 
      left: startX, 
      width: size, height: size * 4, 
      backgroundColor: isCyan ? COLORS.green : COLORS.gold,
      shadowColor: isCyan ? COLORS.green : COLORS.gold,
      shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10,
      transform: [{ translateY }], opacity 
    }]} />
  );
}

// ----------------------------------------------------
// Main Component
// ----------------------------------------------------
export default function ThemeEffects() {
  const { theme } = useThemeStore();
  
  if (theme === 'love') {
    return (
      <View style={styles.container} pointerEvents="none">
        {[...Array(15)].map((_, i) => <HeartBubble key={i} delay={i * 600} />)}
      </View>
    );
  }

  if (theme === 'forest') {
    return (
      <View style={styles.container} pointerEvents="none">
        {[...Array(20)].map((_, i) => <FallingLeaf key={i} delay={i * 400} />)}
      </View>
    );
  }

  if (theme === 'cyberpunk') {
    return (
      <View style={styles.container} pointerEvents="none">
        {[...Array(30)].map((_, i) => <NeonParticle key={i} delay={i * 200} />)}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, // Ensure it's above everything
    elevation: 9999,
  },
  particle: {
    position: 'absolute',
    top: 0,
  }
});
