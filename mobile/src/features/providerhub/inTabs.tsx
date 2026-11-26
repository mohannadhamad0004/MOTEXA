import { createContext, useContext, type ComponentType } from "react";

const InTabs = createContext(false);
/** true when the screen is a tab root of the provider tab shell (no ← back, room for the floating tab bar) */
export const useInTabs = () => useContext(InTabs);
/** Wraps a provider screen that is both a tab root and a stack route (Products = Inventory = Fitment, Jobs = Dispatch). */
export const inTabs = (Screen: ComponentType) =>
  function TabScreen() {
    return (
      <InTabs.Provider value={true}>
        <Screen />
      </InTabs.Provider>
    );
  };
