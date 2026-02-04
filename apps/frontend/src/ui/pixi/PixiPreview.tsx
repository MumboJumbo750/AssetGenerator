import React, { useCallback, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { HelpTip } from "../components/HelpTip";
import { usePixiApp } from "./hooks/usePixiApp";
import { usePixiManifestRenderer } from "./hooks/usePixiManifestRenderer";
import type { KitManifest } from "./types";

async function loadManifest(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as KitManifest;
}

export function PixiPreview() {
  const [manifestPath, setManifestPath] = useState("");
  const [manifest, setManifest] = useState<KitManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<URL | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const { ready: pixiReady, error: pixiError, appRef, stageRef } = usePixiApp(canvasRef);

  const animationNames = useMemo(() => (manifest?.animations ?? []).map((a) => a.name), [manifest]);
  const [selectedAnimation, setSelectedAnimation] = useState<string>("");

  const onLoad = useCallback(async () => {
    setError(null);
    try {
      const url = new URL(manifestPath, window.location.origin);
      const m = await loadManifest(url.toString());
      setManifest(m);
      setManifestUrl(url);
      setSelectedAnimation(m.animations?.[0]?.name ?? "");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [manifestPath]);

  usePixiManifestRenderer({
    ready: pixiReady,
    manifest,
    manifestUrl,
    selectedAnimation,
    appRef,
    stageRef,
    onError: setError
  });

  const errorMessage = error ?? pixiError;

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          style={{ flex: 1 }}
          label={
            <Group gap="xs">
              <span>Manifest path</span>
              <HelpTip label="Paste the Pixi kit manifest path from your export." topicId="exports-pixi" />
            </Group>
          }
          placeholder="Manifest path, e.g. /data/projects/<projectId>/files/exports/<exportId>/pixi-kit/manifest.json"
          value={manifestPath}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setManifestPath(event.currentTarget.value)}
        />
        <Button onClick={onLoad}>Load</Button>
      </Group>
      {manifest && (
        <Group>
          <Text size="sm" c="dimmed">
            Animation
          </Text>
          <HelpTip label="Pick an animation from the atlas to preview." topicId="exports-pixi" />
          <Select
            value={selectedAnimation}
            onChange={(value: string | null) => setSelectedAnimation(value ?? "")}
            data={[{ value: "", label: "(none)" }, ...animationNames.map((n) => ({ value: n, label: n }))]}
            w={260}
          />
          <Badge variant="light">
            atlases={manifest.atlases.length} · images={manifest.images.length} · animations={manifest.animations.length}
          </Badge>
        </Group>
      )}
      {errorMessage && (
        <Text size="sm" c="dimmed">
          Error: {errorMessage}
        </Text>
      )}
      <Card withBorder radius="md" style={{ height: 420, position: "relative", overflow: "hidden" }}>
        <div
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)",
            backgroundSize: "22px 22px",
            backgroundPosition: "0 0, 0 11px, 11px -11px, -11px 0px"
          }}
        />
      </Card>
    </Stack>
  );
}
