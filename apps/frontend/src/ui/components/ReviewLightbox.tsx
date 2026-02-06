import React, { useMemo } from "react";
import { Badge, Button, Card, Group, Image, Rating, Stack, Text, Title } from "@mantine/core";

import type { Asset } from "../api";

export type ReviewDecision = "approve" | "reject";

type ReviewLightboxProps = {
  asset: Asset;
  index: number;
  total: number;
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onDecision: (decision: ReviewDecision) => void;
  onSetRating: (rating: number) => void;
  theaterMode?: boolean;
  policyBadges?: string[];
  evidenceDetails?: Array<{ label: string; value: string }>;
};

function toDataUrl(pathValue?: string) {
  if (!pathValue?.trim()) return "";
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

export function ReviewLightbox({
  asset,
  index,
  total,
  selectedVariantId,
  onSelectVariant,
  onPrev,
  onNext,
  onDecision,
  onSetRating,
  theaterMode,
  policyBadges,
  evidenceDetails,
}: ReviewLightboxProps) {
  const version = asset.versions[asset.versions.length - 1];
  const variants = version?.variants ?? [];
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [variants, selectedVariantId],
  );

  return (
    <Card
      withBorder
      radius="md"
      p="md"
      className={
        theaterMode ? "ag-review-lightbox ag-review-theater ag-card-tier-3" : "ag-review-lightbox ag-card-tier-2"
      }
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>{asset.id}</Title>
          <Badge variant="light">{index + 1 + " / " + total}</Badge>
        </Group>
        {!!policyBadges?.length && (
          <Group gap={6}>
            {policyBadges.map((badge) => (
              <Badge key={badge} size="sm" variant="light" color="cyan">
                {badge}
              </Badge>
            ))}
          </Group>
        )}
        {!!evidenceDetails?.length && (
          <Group gap={6}>
            {evidenceDetails.map((entry) => (
              <Badge key={entry.label} size="sm" variant="outline" color="gray">
                {entry.label}: {entry.value}
              </Badge>
            ))}
          </Group>
        )}

        <div className="ag-review-stage">
          {selectedVariant ? (
            <Image
              src={toDataUrl(selectedVariant.previewPath ?? selectedVariant.alphaPath ?? selectedVariant.originalPath)}
              alt={selectedVariant.id}
              fit="contain"
              h="70vh"
              className="ag-review-stage-image"
            />
          ) : (
            <Text size="sm" c="dimmed">
              This asset has no variants.
            </Text>
          )}
        </div>

        <Group gap="xs" wrap="nowrap" className="ag-review-variant-strip">
          {variants.map((variant, variantIndex) => {
            const src = toDataUrl(variant.previewPath ?? variant.alphaPath ?? variant.originalPath);
            const active = variant.id === selectedVariant?.id;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelectVariant(variant.id)}
                className={active ? "ag-review-variant ag-review-variant-active" : "ag-review-variant"}
                title={`Variant ${variantIndex + 1}`}
              >
                {src ? <img src={src} alt={variant.id} className="ag-review-variant-image" /> : <span>No image</span>}
              </button>
            );
          })}
        </Group>

        <Group justify="space-between" align="center" className="ag-review-actions-row">
          <Group className="ag-review-actions-main">
            {theaterMode && (
              <Text size="sm" fw={700} className="ag-theater-question">
                Keep this variant?
              </Text>
            )}
            <Button variant="light" onClick={onPrev}>
              Prev
            </Button>
            <Button color="red" variant="light" onClick={() => onDecision("reject")}>
              Reject (R)
            </Button>
            <Button color="green" onClick={() => onDecision("approve")}>
              Approve + Next (A)
            </Button>
            <Button variant="light" onClick={onNext}>
              Next
            </Button>
          </Group>
          <Group className="ag-review-actions-rating">
            <Text size="sm" c="dimmed">
              Rating
            </Text>
            <Rating value={selectedVariant?.rating ?? 0} onChange={onSetRating} />
          </Group>
        </Group>

        <Text size="xs" c="dimmed">
          Keyboard: Left/Right navigate, A approve, R reject, 1-5 rate.
        </Text>
      </Stack>
    </Card>
  );
}
