import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Preferences only. Access tokens keep their existing SecureStore/sessionStorage lifecycle.
let writes = Promise.resolve();
export function useLocalPreference<T extends string>(key: 'motexa_language' | 'motexa_appearance' | 'motexa_owner_appearance', initial:T, valid: (value:string)=>value is T) {
  const [value,setValue] = useState<T>(initial);
  const changed = useRef(false);
  useEffect(()=>{
    let active=true;
    const read=async()=>{
      try {
        const saved=Platform.OS==='web' ? (typeof localStorage==='undefined'?null:localStorage.getItem(key)) : await SecureStore.getItemAsync(key);
        if(active&&!changed.current&&saved&&valid(saved))setValue(saved);
      } catch { /* Storage restrictions must not prevent entering the app. */ }
    };
    void read();return()=>{active=false;};
  },[key,valid]);
  const set=useCallback((next:SetStateAction<T>)=>{
    changed.current=true;
    setValue(previous=>typeof next==='function'?next(previous):next);
  },[]);
  useEffect(()=>{
    if(!changed.current)return;
    writes=writes.then(async()=>{
      if(Platform.OS==='web')localStorage.setItem(key,value);
      else await SecureStore.setItemAsync(key,value);
    }).catch(()=>{});
  },[key,value]);
  return [value,set] as const;
}

