import { useEffect, useState } from "react";

/** true only once `flag` has stayed true for `ms` (the road loader / radar appear only when work really takes time). */
export function useDelayed(flag: boolean, ms = 300): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!flag) {
      setOn(false);
      return;
    }
    const id = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(id);
  }, [flag, ms]);
  return on && flag;
}
