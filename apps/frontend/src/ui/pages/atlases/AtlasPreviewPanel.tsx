import React from "react";
import { Card, Group, Select, Stack, Text } from "@mantine/core";

import type { AtlasRecord } from "../../api";

type Props = {
  atlases: AtlasRecord[];
  selectedAtlasId: string | null;
  selectedAtlas: AtlasRecord | null;
  atlasError: string | null;
  imageSize: { naturalW: number; naturalH: number; displayW: number; displayH: number };
  atlasImageRef: React.RefObject<HTMLImageElement>;
  onSelectAtlasId: (value: string | null) => void;
  onImageLoad: () => void;
};

export function AtlasPreviewPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>Atlas preview</Text>
          <Select
            data={props.atlases.map((a) => ({ value: a.id, label: a.id }))}
            value={props.selectedAtlasId ?? ""}
            onChange={(value: string | null) => props.onSelectAtlasId(value ?? null)}
            placeholder="Select atlas"
          />
        </Group>
        {props.atlasError && <Text size="xs">Atlas error: {props.atlasError}</Text>}
        {!props.selectedAtlas && <Text size="sm">Select an atlas to preview.</Text>}
        {props.selectedAtlas && (
          <div style={{ position: "relative", maxWidth: 520 }}>
            <img
              ref={props.atlasImageRef}
              src={`/data/${props.selectedAtlas.imagePath}`}
              style={{ width: "100%", borderRadius: 12 }}
              onLoad={props.onImageLoad}
            />
            {props.selectedAtlas.frames.map((frame) => {
              const scaleX = props.imageSize.displayW / props.imageSize.naturalW;
              const scaleY = props.imageSize.displayH / props.imageSize.naturalH;
              const pivot = frame.pivot ?? { x: 0.5, y: 0.5 };
              return (
                <div
                  key={frame.id}
                  style={{
                    position: "absolute",
                    left: frame.rect.x * scaleX,
                    top: frame.rect.y * scaleY,
                    width: frame.rect.w * scaleX,
                    height: frame.rect.h * scaleY,
                    border: "1px solid rgba(46,203,255,0.6)"
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: pivot.x * frame.rect.w * scaleX - 4,
                      top: pivot.y * frame.rect.h * scaleY - 4,
                      width: 8,
                      height: 8,
                      borderRadius: 8,
                      background: "rgba(124,77,255,0.9)",
                      boxShadow: "0 0 6px rgba(124,77,255,0.7)"
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Stack>
    </Card>
  );
}
