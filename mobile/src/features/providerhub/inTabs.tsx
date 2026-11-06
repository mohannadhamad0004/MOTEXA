import type { ComponentType } from "react";
import { InTabs } from "../../components/layout/ProviderLayout";

/** Wraps an existing provider screen so its ProviderLayout drops the link chips / back row inside the tab shell. */
export const inTabs = (Screen: ComponentType) =>
  function TabScreen() {
    return (
      <InTabs.Provider value={1}>
        <Screen />
      </InTabs.Provider>
    );
  };
