import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  TouchableOpacityProps,
} from "react-native";
import { motion } from "./DesignTokens";
import { useReducedMotion } from "./MotexaVisual";
export default function InteractiveButton({
  style,
  activeOpacity = 0.82,
  onFocus,
  onBlur,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...props
}: TouchableOpacityProps) {
  const [focused, setFocused] = useState(false),
    reduced = useReducedMotion(),
    highlight = useRef(new Animated.Value(0)).current;
  useEffect(() => () => highlight.stopAnimation(), [highlight]);
  const feedback = (pressed: boolean) => {
    highlight.stopAnimation();
    if (reduced) {
      highlight.setValue(pressed ? 1 : 0);
      return;
    }
    Animated.timing(highlight, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? motion.press : motion.release,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  };
  // Keep the native Pressable as the layout owner: animated wrappers previously lost card dimensions.
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) feedback(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        feedback(false);
        onPressOut?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={({ pressed, hovered }) => [
        style,
        hovered && !disabled && { opacity: 0.92 },
        pressed && !disabled && { opacity: activeOpacity },
        disabled && { opacity: 0.55 },
        focused && {
          outlineColor: "#9C6B3D",
          outlineWidth: 2,
          outlineOffset: 3,
          outlineStyle: "solid",
        },
      ]}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        accessible={false}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: StyleSheet.flatten(style)?.borderRadius || 0,
            backgroundColor: "#FFFFFF12",
            opacity: highlight,
          },
        ]}
      />
    </Pressable>
  );
}
