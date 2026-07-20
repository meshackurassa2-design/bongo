import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useThemeStore } from '../store/themeStore';


const { width, height } = Dimensions.get('window');

interface Props {
  isReady: boolean;
}

export default function AnimatedSplash({ isReady }: Props) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance: Slide up and fade in the words
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(textTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isReady) {
      // Give it a fixed minimum time to be seen, then exit
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsAnimationComplete(true);
        });
      }, 1200); // Hold for 1.2 seconds before disappearing
    }
  }, [isReady]);

  if (isAnimationComplete) return null;

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        <Animated.Text style={[styles.title, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
          Bongo Stream
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
          Tanzania's Music Platform
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
});
