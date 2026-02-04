import { useMemo } from "react";

export function useOnboardingStep(opts: {
  verifyReady: boolean;
  specListsCount: number;
  specsCount: number;
  jobsCount: number;
  assetsCount: number;
}) {
  return useMemo(() => {
    if (!opts.verifyReady) return 0;
    if (opts.specListsCount === 0) return 1;
    if (opts.specsCount === 0) return 2;
    if (opts.jobsCount === 0) return 3;
    if (opts.assetsCount === 0) return 4;
    return 5;
  }, [opts]);
}
