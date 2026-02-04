import { useState } from "react";

export function useSystemLogService() {
  const [systemLogService, setSystemLogService] = useState<"backend" | "worker">("backend");

  return { systemLogService, setSystemLogService };
}
