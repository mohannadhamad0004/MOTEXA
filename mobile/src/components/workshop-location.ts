import * as Location from 'expo-location';
export async function askPosition(){const permission=await Location.requestForegroundPermissionsAsync();if(permission.status!=='granted')throw Error('LOCATION_DENIED');return Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});}
export function watchPosition(callback:(p:Location.LocationObject)=>void){return Location.watchPositionAsync({accuracy:Location.Accuracy.High,distanceInterval:10,timeInterval:5000},callback);}
export {distance} from './workshop-distance';
