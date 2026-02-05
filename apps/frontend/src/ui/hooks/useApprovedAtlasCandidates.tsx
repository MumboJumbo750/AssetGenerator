import { useMemo } from "react";

import type { Asset } from "../api";

type Candidate = {
  assetId: string;
  versionId: string;
  variantId: string;
  path: string;
};

export function useApprovedAtlasCandidates(assets: Asset[]) {
  return useMemo(() => {
    return assets
      .map((asset) => {
        const approvedVersions = asset.versions.filter((v) => v.status === "approved");
        const version = approvedVersions.length ? approvedVersions[approvedVersions.length - 1] : null;
        if (!version) return null;
        const primary = version.primaryVariantId
          ? version.variants.find((v) => v.id === version.primaryVariantId)
          : null;
        const selected = version.variants.find((v) => v.status === "selected") ?? null;
        const candidate = version.variants[0] ?? null;
        const variant = primary ?? selected ?? candidate;
        if (!variant?.originalPath) return null;
        const path = variant.alphaPath ?? variant.originalPath;
        return { assetId: asset.id, versionId: version.id, variantId: variant.id, path };
      })
      .filter(Boolean) as Candidate[];
  }, [assets]);
}
