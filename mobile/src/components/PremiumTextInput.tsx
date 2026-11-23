import {useOwnerIdentity} from './OwnerIdentity';
import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps, type TextStyle } from 'react-native';
import { useAppearance } from './Appearance';

const PremiumTextInput = forwardRef<TextInput,TextInputProps>(function PremiumTextInput({style,onFocus,onBlur,placeholderTextColor,...props},ref){
  const {dark}=useAppearance(),owner=useOwnerIdentity();
  const [focused,setFocused]=useState(false);
  const flat=StyleSheet.flatten(style);
  const ring: TextStyle=focused&&props.editable!==false?{
    ...(flat?.borderWidth||flat?.borderBottomWidth?{borderColor:dark?'#EDC38F':'#9B6538'}:{}),
    ...(Platform.OS==='web'&&!owner?{outlineStyle:'solid',outlineColor:dark?'#EDC38F':'#9B6538',outlineWidth:2,outlineOffset:2}:{}),
  }:{};
  return <TextInput {...props} ref={ref} style={[style,owner?{outlineWidth:0}:undefined,ring]} placeholderTextColor={placeholderTextColor??(dark?'#BFA88D':'#8D7964')}
    onFocus={e=>{setFocused(true);onFocus?.(e);}} onBlur={e=>{setFocused(false);onBlur?.(e);}}/>;
});
export default PremiumTextInput;
