import {createContext,useContext} from 'react';
export const OwnerIdentity=createContext(false);
export const useOwnerIdentity=()=>useContext(OwnerIdentity);
