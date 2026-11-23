import Svg,{Path,Rect,Circle,Line} from 'react-native-svg';
import {automotive} from '../../../src/components/DesignTokens';
export default function Cockpit({width,height}:{width:number;height:number}){const c=automotive.dark;return <Svg width={width} height={height} viewBox="0 0 900 1600" preserveAspectRatio="xMidYMid slice"><Rect width="900" height="1600" fill={c.canvas}/>
<Path d="M120 250 Q450 170 790 250 L880 690 L20 690Z" fill={c.surface} stroke={c.border} strokeWidth="5"/><Path d="M410 350 L490 350 L710 690 L190 690Z" fill={c.canvas}/><Line x1="450" y1="385" x2="450" y2="630" stroke={c.bronze} strokeWidth="4" strokeDasharray="28 30"/>
<Path d="M0 740 Q450 620 900 750 L900 1100 Q450 970 0 1100Z" fill={c.soft} stroke={c.bronze} strokeWidth="4"/>
<Rect x="150" y="740" width="280" height="180" rx="35" fill={c.canvas} stroke={c.border} strokeWidth="3"/>
<Circle cx="270" cy="832" r="70" fill="none" stroke={c.bronze} strokeWidth="3"/><Path d="M270 832 L295 790" stroke={c.ink} strokeWidth="6"/>
<Rect x="531" y="768" width="279" height="224" rx="12" fill={c.canvas} stroke={c.bronze} strokeWidth="4"/><Path d="M565 860 L640 810 L680 900 L770 825" stroke={c.bronze} strokeWidth="3" fill="none"/>
<Circle cx="270" cy="1050" r="210" fill="none" stroke={c.canvas} strokeWidth="65"/><Circle cx="270" cy="1050" r="210" fill="none" stroke={c.bronze} strokeWidth="3"/><Circle cx="270" cy="1050" r="58" fill={c.surface} stroke={c.border} strokeWidth="3"/>
<Path d="M215 1030 L80 980 M325 1030 L460 980 M270 1110 L270 1250" stroke={c.canvas} strokeWidth="32"/>
<Path d="M570 1020 L780 1020 L840 1600 L450 1600Z" fill={c.surface} stroke={c.border} strokeWidth="3"/></Svg>;}
