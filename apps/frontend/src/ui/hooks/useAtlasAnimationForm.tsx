import { useState } from "react";

export function useAtlasAnimationForm() {
  const [animationName, setAnimationName] = useState("");
  const [animationFps, setAnimationFps] = useState(12);
  const [animationLoop, setAnimationLoop] = useState(true);
  const [animationSpecId, setAnimationSpecId] = useState<string>("");

  return {
    animationName,
    animationFps,
    animationLoop,
    animationSpecId,
    setAnimationName,
    setAnimationFps,
    setAnimationLoop,
    setAnimationSpecId
  };
}
