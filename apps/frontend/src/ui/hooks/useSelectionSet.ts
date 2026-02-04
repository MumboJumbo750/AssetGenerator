import { useCallback, useMemo, useState } from "react";

export function useSelectionSet<T extends string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((value: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const select = useCallback((values: T[]) => setSelected(new Set(values)), []);

  const has = useCallback((value: T) => selected.has(value), [selected]);

  const count = useMemo(() => selected.size, [selected]);

  return { selected, toggle, clear, select, has, count };
}
