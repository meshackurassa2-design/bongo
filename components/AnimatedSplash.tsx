import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text, Easing } from 'react-native';
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
    // Premium entrance: Smoothly slide up and fade in the words
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
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
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsAnimationComplete(true);
        });
      }, 1500); 
    }
  }, [isReady]);

  if (isAnimationComplete) return null;

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        <Animated.Text style={[styles.title, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
          Bongo Streaming
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
    color: '#FF3565',
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.5,
    marginBottom: 4,
    textShadowColor: 'rgba(255, 53, 101, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 5,
    opacity: 0.9,
  },
});
