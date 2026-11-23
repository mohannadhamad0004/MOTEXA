import {createContext,useContext} from 'react';
import type {SharedValue} from 'react-native-reanimated';

type MotionContext={scroll:SharedValue<number>;scrollTo:(y:number,animated?:boolean)=>void};
export const OwnerMotionContext=createContext<MotionContext|null>(null);
export function useOwnerMotion(){const value=useContext(OwnerMotionContext);if(!value)throw Error('Owner motion requires the owner workspace shell.');return value;}
