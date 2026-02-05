import { useCallback, useMemo, useState } from "react";

import { fetchComfyUiVerify, type ComfyUiVerify } from "../services/systemService";
import { useAsyncAction } from "./useAsyncAction";

export function useComfyVerify() {
  const [verify, setVerify] = useState<ComfyUiVerify | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyAction = useAsyncAction(async () => {
    const result = await fetchComfyUiVerify();
    setVerify(result);
  });

  const verifyReady = useMemo(() => {
    if (!verify) return false;
    const workflowsOk = verify.workflowFiles.every((f) => f.exists);
    const pathsOk = verify.localConfig.missingRoots.length === 0;
    const checkpointsOk = verify.checkpoints.every((c) => c.exists);
    return verify.comfyui.ok && workflowsOk && pathsOk && checkpointsOk;
  }, [verify]);

  const runVerify = useCallback(async () => {
    setVerifyError(null);
    try {
      await verifyAction.run();
    } catch (e: any) {
      setVerify(null);
      setVerifyError(e?.message ?? String(e));
    }
  }, [verifyAction]);

  return {
    verify,
    verifyError,
    verifyReady,
    runVerify,
    loading: verifyAction.loading,
  };
}
