import Svg,{Path,Ellipse,Rect,Line,G} from 'react-native-svg';
import {automotive} from '../../../src/components/DesignTokens';
export default function Exterior({width,height}:{width:number;height:number}){const c=automotive.dark;return <Svg width={width} height={height} viewBox="0 0 900 1600" preserveAspectRatio="xMidYMid slice">
<Rect width="900" height="1600" fill={c.canvas}/><Path d="M0 1090 L900 1040 L900 1600 L0 1600Z" fill={c.surface}/>
{[0,1,2,3,4].map(i=><Line key={i} x1={i*225-90} y1="1600" x2="450" y2="1000" stroke={c.border} strokeWidth="2"/>)}
<Ellipse cx="450" cy="1140" rx="410" ry="45" fill={c.canvas}/>
<G transform="translate(67.5 120) scale(.85)"><Path d="M55 1020 L100 820 L250 770 L300 640 Q470 580 630 650 L745 790 L825 880 L855 1040 L780 1110 L130 1140Z" fill={c.soft} stroke={c.bronze} strokeWidth="4"/>
<Path d="M252 840 L252 640 L648 640 L648 840Z" fill={c.canvas} stroke={c.bronze} strokeWidth="4"/>
<Path d="M120 840 L730 800 L795 960 L100 1030Z" fill={c.surface} stroke={c.border} strokeWidth="3"/>
<Path d="M120 860 L310 870 L280 910 L105 912 M570 850 L740 830 L770 875 L590 890" fill="none" stroke={c.ink} strokeWidth="9"/>
<Path d="M300 945 L590 925 L650 1025 L260 1048Z" fill={c.canvas} stroke={c.bronze} strokeWidth="3"/>
{[0,1,2,3,4,5].map(i=><Line key={i} x1={300+i*52} y1="965" x2={280+i*61} y2="1020" stroke={c.border} strokeWidth="4"/>)}
<Ellipse cx="175" cy="1080" rx="45" ry="72" fill={c.canvas} stroke={c.bronze} strokeWidth="4"/><Ellipse cx="748" cy="1040" rx="43" ry="75" fill={c.canvas} stroke={c.bronze} strokeWidth="4"/>
</G><Line x1="0" y1="1180" x2="900" y2="1180" stroke={c.border} strokeWidth="2"/></Svg>;}
