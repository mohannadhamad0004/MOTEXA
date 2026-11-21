// Until MOTEXA approves the application, a provider can sign in but lands only on the onboarding / status screens.
// UX only: the server also refuses provider actions with 403 until APPROVED.
import { Redirect } from "expo-router";
import { ReactNode, useEffect, useState } from "react";
import { onboarding } from "./api";

export function ApprovedGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "onboarding">("checking");
  useEffect(() => {
    let alive = true;
    onboarding.status().then(
      (s) => alive && setState(s.status === "APPROVED" ? "ok" : "onboarding"),
      // a failed check must not lock out an approved provider: the server enforces the rule anyway
      () => alive && setState("ok"),
    );
    return () => {
      alive = false;
    };
  }, []);
  if (state === "checking") return null;
  if (state === "onboarding") return <Redirect href={"/provider/onboarding" as never} />;
  return <>{children}</>;
}
