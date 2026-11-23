import Svg,{Rect,Path,Line,Circle} from 'react-native-svg';
import {automotive} from '../../../src/components/DesignTokens';
export default function Dashboard({width,height}:{width:number;height:number}){const c=automotive.dark;return <Svg width={width} height={height} viewBox="0 0 900 1600" preserveAspectRatio="xMidYMid slice"><Rect width="900" height="1600" fill={c.canvas}/><Path d="M0 570 L900 520 L900 1140 L0 1170Z" fill={c.surface} stroke={c.border} strokeWidth="5"/><Rect x="100" y="620" width="700" height="490" rx="28" fill={c.canvas} stroke={c.bronze} strokeWidth="6"/>
<Rect x="130" y="655" width="640" height="420" rx="12" fill={c.soft}/><Path d="M155 970 L290 820 L430 875 L550 730 L740 860" fill="none" stroke={c.bronze} strokeWidth="5"/>
<Circle cx="550" cy="730" r="12" fill={c.ink}/><Line x1="175" y1="1020" x2="695" y2="1020" stroke={c.border} strokeWidth="3"/>
{[0,1,2].map(i=><Circle key={i} cx={260+i*190} cy="1260" r="42" stroke={c.bronze} strokeWidth="3" fill={c.surface}/>)}</Svg>;}
