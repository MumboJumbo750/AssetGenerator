import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type ExpertModeContextValue = {
  expertMode: boolean;
  setExpertMode: (value: boolean) => void;
  toggleExpertMode: () => void;
};

const STORAGE_KEY = "ag-expert-mode";

const ExpertModeContext = createContext<ExpertModeContextValue | null>(null);

export function useExpertMode() {
  const ctx = useContext(ExpertModeContext);
  if (!ctx) throw new Error("useExpertMode must be used inside ExpertModeProvider");
  return ctx;
}

export function ExpertModeProvider({ children }: { children: React.ReactNode }) {
  const [expertMode, setExpertModeRaw] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(expertMode));
    } catch {
      // ignore storage errors
    }
  }, [expertMode]);

  const setExpertMode = useCallback((value: boolean) => {
    setExpertModeRaw(value);
  }, []);

  const toggleExpertMode = useCallback(() => {
    setExpertModeRaw((prev) => !prev);
  }, []);

  const value = React.useMemo<ExpertModeContextValue>(
    () => ({ expertMode, setExpertMode, toggleExpertMode }),
    [expertMode, setExpertMode, toggleExpertMode],
  );

  return <ExpertModeContext.Provider value={value}>{children}</ExpertModeContext.Provider>;
}
