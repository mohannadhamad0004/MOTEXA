import { useAppearance } from "./Appearance";
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

export function PanelFill({kind = 'light', radius = 22}: {kind?: 'light' | 'hero' | 'accent'; radius?: number}) {
  const {dark}=useAppearance();
  const colors: readonly [string,string,string] = kind === 'hero'
    ? ['#775138','#493327','#2D2521']
    : kind === 'accent' ? dark ? ['#69482D','#513923','#402D20'] : ['#F1D3A8','#D6AE78','#BA8B52']
    : dark ? ['#423226','#362A22','#2D241E'] : ['#FFF9EE','#F4E7D3','#E9D7BD'];
  return <LinearGradient pointerEvents="none" accessible={false} colors={colors} start={{x:0,y:0}} end={{x:1,y:1}} style={[StyleSheet.absoluteFill,{borderRadius:radius}]}/>;
}
export function CanvasFill() {
  const {dark}=useAppearance();
  return <LinearGradient pointerEvents="none" accessible={false} colors={dark ? ['#211B17','#30251D','#241D18'] : ['#E4D5C1','#CEB797','#DDCAB1']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>;
}
