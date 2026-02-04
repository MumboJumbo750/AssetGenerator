export type AssetListItem = {
  id: string;
  specId: string;
  assetType: string | null;
  versionsCount: number;
  latestStatus: string | null;
  thumbnailPath: string | null;
};

export type AssetFilters = {
  searchQuery: string;
  statusFilter: string | null;
  tagFilter: string | null;
  assetTypeFilter: string | null;
};

export type TagOption = { value: string; label: string };

export type SpecListItem = {
  id: string;
  title: string;
  status: string;
};
