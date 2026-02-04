import { useEffect, useRef, useState } from "react";
import { Application, Container } from "pixi.js";

export function usePixiApp(hostRef: React.RefObject<HTMLDivElement>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<Container | null>(null);
  const instanceRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const instanceId = (instanceRef.current += 1);
    setReady(false);

    const app = new Application();
    appRef.current = app;

    const stage = new Container();
    stageRef.current = stage;

    const isActive = () =>
      !cancelled && instanceRef.current === instanceId && appRef.current === app && stageRef.current === stage;

    (async () => {
      try {
        await app.init({ backgroundAlpha: 0, resizeTo: host });
        if (!isActive()) return;
        host.appendChild(app.canvas);
        app.stage.addChild(stage);
        setReady(true);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      setReady(false);
      try {
        stage.removeChildren();
      } catch {
        // ignore
      }
      try {
        app.canvas?.remove();
      } catch {
        // ignore
      }
      try {
        if (app && typeof app.destroy === "function") app.destroy();
      } catch {
        // ignore
      }
      if (appRef.current === app) appRef.current = null;
      if (stageRef.current === stage) stageRef.current = null;
    };
  }, [hostRef]);

  return { ready, error, appRef, stageRef };
}
