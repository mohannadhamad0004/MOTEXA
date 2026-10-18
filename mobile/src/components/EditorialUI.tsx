import React, { Children } from 'react';
import { StyleSheet, View, ViewProps, useWindowDimensions } from 'react-native';
import { Text } from './MotexaVisual';

export function EditorialSplit({children, reverse = false}: {children: React.ReactNode; reverse?: boolean}) {
  const {width} = useWindowDimensions();
  const wide = width >= 900;
  const parts = Children.toArray(children);
  return <View style={[styles.split, wide && {flexDirection: reverse ? 'row-reverse' : 'row', gap:48}]}>
    <View style={[styles.column, wide && {width:'49%'}]}>{parts[0]}</View>
    <View style={[styles.column, wide && {flex:1, alignSelf:'center'}]}>{parts.slice(1)}</View>
  </View>;
}

/** Brand artwork drawn with native Views. It has no hit targets or network assets. */
export function MobilityArtwork({compact = false}: {compact?: boolean}) {
  const {width} = useWindowDimensions();
  const small = width < 900;
  const teaser = compact && small;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.art,{height:teaser?80:small?146:270}]}>
    <View style={[styles.drawing, {transform:[{scale:teaser?0.47:small?0.62:1}]}]}>
      {[0,1,2,3,4,5,6].map(i=><View key={'h'+i} style={[styles.grid,{top:i*42}]}/>)}
      {[0,1,2,3,4,5,6,7].map(i=><View key={'v'+i} style={[styles.gridVertical,{left:i*45}]}/>)}
      <View style={styles.orbit}/><View style={styles.innerOrbit}/>
      <View style={styles.road}/><View style={styles.roadCentre}/>
      <View style={styles.car}>
        <View style={[styles.wheel,{left:-8,top:29}]}/><View style={[styles.wheel,{right:-8,top:29}]}/>
        <View style={[styles.wheel,{left:-8,bottom:24}]}/><View style={[styles.wheel,{right:-8,bottom:24}]}/>
        <View style={styles.carBody}>
          <View style={styles.bonnet}/><View style={styles.windshield}/><View style={styles.roof}/><View style={styles.rearWindow}/>
          <View style={[styles.light,{left:8}]}/><View style={[styles.light,{right:8}]}/>
          <View style={styles.tail}/>
        </View>
      </View>
      <View style={styles.pin}><View style={styles.pinCore}/></View>
    </View>
    <Text style={styles.artIndex}>M / 01</Text><Text style={styles.artCaption}>ALWAYS MOVING FORWARD</Text>
  </View>;
}

export function MetricSurface({style, ...props}: ViewProps) {
  const {width} = useWindowDimensions();
  return <View {...props} style={[style,{width:width>=1000?'31.8%':'48.2%'}]}/>;
}

const styles=StyleSheet.create({
 split:{width:'100%',gap:28,alignItems:'stretch'},column:{width:'100%'},
 art:{width:'100%',overflow:'hidden',justifyContent:'center',alignItems:'center',marginTop:22},
 drawing:{width:320,height:270,position:'absolute'},
 grid:{height:1,width:320,position:'absolute',backgroundColor:'#E8BA7C0D'},gridVertical:{width:1,height:270,position:'absolute',backgroundColor:'#E8BA7C0D'},
 orbit:{position:'absolute',width:247,height:247,borderRadius:125,borderWidth:1,borderColor:'#D9AD7444',top:12,left:36},
 innerOrbit:{position:'absolute',width:185,height:185,borderRadius:95,borderWidth:1,borderColor:'#D9AD7422',top:43,left:67},
 road:{position:'absolute',width:100,height:400,borderLeftWidth:1,borderRightWidth:1,borderColor:'#D9AD7455',top:-65,left:110,transform:[{rotate:'26deg'}]},
 roadCentre:{position:'absolute',width:1,height:400,backgroundColor:'#D9AD7425',top:-65,left:160,transform:[{rotate:'26deg'}]},
 car:{position:'absolute',width:74,height:153,left:123,top:57,transform:[{rotate:'26deg'}]},
 carBody:{flex:1,borderWidth:1.5,borderColor:'#ECC48E',backgroundColor:'#37281B',borderTopLeftRadius:24,borderTopRightRadius:24,borderBottomLeftRadius:16,borderBottomRightRadius:16,overflow:'hidden'},
 wheel:{position:'absolute',width:9,height:25,borderRadius:3,backgroundColor:'#CDA472'},
 bonnet:{height:35,marginHorizontal:13,marginTop:11,borderBottomWidth:1,borderBottomColor:'#C99D6655',borderTopWidth:1,borderTopColor:'#C99D6633',borderRadius:8},
 windshield:{marginTop:3,marginHorizontal:9,height:25,borderRadius:6,backgroundColor:'#BA8C4D33',borderWidth:1,borderColor:'#D6AD7266'},
 roof:{height:28,marginHorizontal:13,borderLeftWidth:1,borderRightWidth:1,borderColor:'#D6AD7244'},
 rearWindow:{height:20,marginHorizontal:9,borderRadius:5,backgroundColor:'#BA8C4D33',borderWidth:1,borderColor:'#D6AD7266'},
 light:{position:'absolute',top:9,width:12,height:3,borderRadius:2,backgroundColor:'#F5D8A9'},tail:{position:'absolute',bottom:7,left:10,right:10,height:2,backgroundColor:'#C28E57'},
 pin:{position:'absolute',right:27,top:38,width:18,height:18,borderRadius:9,backgroundColor:'#A7783D33',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#DAAE74'},pinCore:{width:5,height:5,borderRadius:3,backgroundColor:'#EDC58E'},
 artIndex:{position:'absolute',left:0,bottom:5,fontSize:9,letterSpacing:2,color:'#AE895E'},artCaption:{position:'absolute',right:0,bottom:5,fontSize:7,letterSpacing:1.4,color:'#AE895E'},
});
