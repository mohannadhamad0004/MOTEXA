import { forwardRef, useState } from 'react';
import { Platform, Pressable as NativePressable, StyleSheet, type PressableProps, type View, type ViewStyle } from 'react-native';
import { useReducedMotion } from './MotexaVisual';

/** Preserves every caller's layout, interaction handlers and accessibility semantics. */
const MotionPressable = forwardRef<View, PressableProps & { focusVisibleOnly?:boolean }>(function MotionPressable({style,onFocus,onBlur,focusVisibleOnly=false,...props},ref) {
  const [focused,setFocused]=useState(false);
  const reduced=useReducedMotion();
  return <NativePressable {...props} ref={ref}
    onFocus={e=>{const target=e.currentTarget as unknown as {matches?:(selector:string)=>boolean};setFocused(!focusVisibleOnly||Platform.OS!=="web"||(target.matches?.(":focus-visible")??true));onFocus?.(e);}}
    onBlur={e=>{setFocused(false);onBlur?.(e);}}
    style={state=>{
      const resolved=typeof style==='function'?style(state):style;
      const base=StyleSheet.flatten(resolved);
      const web: ViewStyle & {transitionProperty?:string;transitionDuration?:string} = Platform.OS==='web'?{
        cursor:props.disabled?'auto':'pointer',
        ...(!reduced?{transitionProperty:'opacity, box-shadow, border-color',transitionDuration:'160ms'}:{}),
      }:{};
      return [resolved,web,
        state.hovered&&!props.disabled&&{opacity:Math.min(Number(base?.opacity??1),.9)},
        focused&&Platform.OS==='web'&&{outlineStyle:'solid',outlineWidth:2,outlineOffset:3,outlineColor:'#B98752'},
      ];
    }}/>
});
export default MotionPressable;
