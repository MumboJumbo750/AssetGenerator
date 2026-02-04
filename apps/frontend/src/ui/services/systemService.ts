import { getComfyUiVerify, getSystemStatus, type ComfyUiVerify, type SystemStatus } from "../api";

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return getSystemStatus();
}

export async function fetchComfyUiVerify(): Promise<ComfyUiVerify> {
  return getComfyUiVerify();
}

export type { ComfyUiVerify, SystemStatus };
