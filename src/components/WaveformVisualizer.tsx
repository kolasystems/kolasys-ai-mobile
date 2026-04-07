import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../lib/theme';

const BAR_COUNT = 32;

interface Props {
  isRecording: boolean;
  meteringLevel: number; // 0–1
  color?: string;
}

export function WaveformVisualizer({ isRecording, meteringLevel, color = Colors.primary }: Props) {
  const bars = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.1))
  ).current;

  const animationsRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!isRecording) {
      // Settle all bars to minimum when not recording
      Animated.parallel(bars.map((bar) => Animated.spring(bar, { toValue: 0.05, useNativeDriver: false }))).start();
      return;
    }

    // Animate bars based on metering level + randomness for visual interest
    const update = () => {
      const animations = bars.map((bar, i) => {
        // Each bar gets a slightly different height based on position and metering
        const phase = (i / BAR_COUNT) * Math.PI * 2;
        const wave = (Math.sin(phase + Date.now() / 200) + 1) / 2;
        const noise = Math.random() * 0.3;
        const height = Math.max(0.05, meteringLevel * (0.4 + wave * 0.4 + noise * 0.2));
        return Animated.spring(bar, {
          toValue: height,
          useNativeDriver: false,
          speed: 40,
          bounciness: 2,
        });
      });
      animationsRef.current = Animated.parallel(animations);
      animationsRef.current.start(({ finished }) => {
        if (finished && isRecording) update();
      });
    };

    update();
    return () => animationsRef.current?.stop();
  }, [isRecording, meteringLevel]);

  return (
    <View style={styles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              opacity: 0.6 + (i % 3) * 0.13,
              height: bar.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 3,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
});
