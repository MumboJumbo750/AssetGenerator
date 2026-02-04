import { useEffect, useRef } from "react";
import { AnimatedSprite, Assets, Container, Sprite, Spritesheet, Texture } from "pixi.js";

import type { KitManifest } from "../types";

export function usePixiManifestRenderer(opts: {
  ready: boolean;
  manifest: KitManifest | null;
  manifestUrl: URL | null;
  selectedAnimation: string;
  appRef: React.RefObject<{ renderer: { width: number; height: number } } | null>;
  stageRef: React.RefObject<Container | null>;
  onError: (msg: string | null) => void;
}) {
  const sheetsRef = useRef<Map<string, Spritesheet>>(new Map());

  useEffect(() => {
    const stage = opts.stageRef.current;
    if (!opts.ready || !stage || !opts.manifest || !opts.manifestUrl) return;
    const manifest = opts.manifest;
    const manifestUrl = opts.manifestUrl;

    let cancelled = false;
    const isActive = () => !cancelled && opts.stageRef.current === stage;

    (async () => {
      if (!isActive()) return;
      stage.removeChildren();
      sheetsRef.current.clear();

      for (const atlas of manifest.atlases) {
        const dataUrl = new URL(atlas.dataPath, manifestUrl);
        const sheet = (await Assets.load(dataUrl.toString())) as Spritesheet;
        if (!isActive()) return;
        if (sheet?.textures) sheetsRef.current.set(atlas.id, sheet);
      }

      for (const img of manifest.images) {
        const imgUrl = new URL(img.path, manifestUrl);
        await Assets.load(imgUrl.toString());
        if (!isActive()) return;
      }

      const anim = manifest.animations.find((x) => x.name === opts.selectedAnimation);
      if (anim) {
        const sheet = sheetsRef.current.get(anim.atlasId);
        if (!sheet) throw new Error(`Atlas not loaded: ${anim.atlasId}`);
        const textures: Texture[] = anim.frames.map((k) => sheet.textures[k]).filter(Boolean);

        const sprite = new AnimatedSprite(textures);
        sprite.anchor.set(0.5);
        if (!isActive()) return;
        sprite.x = (opts.appRef.current?.renderer.width ?? 0) / 2;
        sprite.y = (opts.appRef.current?.renderer.height ?? 0) / 2;
        sprite.animationSpeed = anim.fps / 60;
        sprite.loop = anim.loop;
        sprite.play();
        stage.addChild(sprite);
        return;
      }

      const first = manifest.images[0];
      if (first) {
        const imgUrl = new URL(first.path, manifestUrl);
        const tex = (await Assets.load(imgUrl.toString())) as Texture;
        if (!isActive()) return;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.x = (opts.appRef.current?.renderer.width ?? 0) / 2;
        sprite.y = (opts.appRef.current?.renderer.height ?? 0) / 2;
        stage.addChild(sprite);
      }
    })().catch((e) => opts.onError(e?.message ?? String(e)));

    return () => {
      cancelled = true;
    };
  }, [opts.ready, opts.manifest, opts.manifestUrl, opts.selectedAnimation, opts.appRef, opts.stageRef, opts.onError]);
}
