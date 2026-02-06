import React from "react";
import { Group, Select, TextInput } from "@mantine/core";

type Option = { value: string; label: string };

type FilterBarProps = {
  query: string;
  status: string;
  assetType: string;
  stage: string;
  loraMode?: string;
  styleConsistency?: string;
  backgroundPolicy?: string;
  statusOptions: Option[];
  assetTypeOptions: Option[];
  stageOptions: Option[];
  loraModeOptions?: Option[];
  styleConsistencyOptions?: Option[];
  backgroundPolicyOptions?: Option[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onAssetTypeChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onLoraModeChange?: (value: string) => void;
  onStyleConsistencyChange?: (value: string) => void;
  onBackgroundPolicyChange?: (value: string) => void;
};

export function FilterBar({
  query,
  status,
  assetType,
  stage,
  loraMode,
  styleConsistency,
  backgroundPolicy,
  statusOptions,
  assetTypeOptions,
  stageOptions,
  loraModeOptions,
  styleConsistencyOptions,
  backgroundPolicyOptions,
  onQueryChange,
  onStatusChange,
  onAssetTypeChange,
  onStageChange,
  onLoraModeChange,
  onStyleConsistencyChange,
  onBackgroundPolicyChange,
}: FilterBarProps) {
  return (
    <Group grow className="ag-filter-bar" align="flex-end">
      <TextInput
        className="ag-filter-field ag-filter-query"
        placeholder="Search by id/title"
        value={query}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onQueryChange(event.currentTarget.value)}
      />
      <Select
        className="ag-filter-field"
        data={statusOptions}
        value={status}
        onChange={(value) => onStatusChange(value ?? "all")}
      />
      <Select
        className="ag-filter-field"
        data={assetTypeOptions}
        value={assetType}
        onChange={(value) => onAssetTypeChange(value ?? "all")}
      />
      <Select
        className="ag-filter-field"
        data={stageOptions}
        value={stage}
        onChange={(value) => onStageChange(value ?? "all")}
      />
      {loraModeOptions && onLoraModeChange && (
        <Select
          className="ag-filter-field"
          data={loraModeOptions}
          value={loraMode ?? "all"}
          onChange={(value) => onLoraModeChange(value ?? "all")}
        />
      )}
      {styleConsistencyOptions && onStyleConsistencyChange && (
        <Select
          className="ag-filter-field"
          data={styleConsistencyOptions}
          value={styleConsistency ?? "all"}
          onChange={(value) => onStyleConsistencyChange(value ?? "all")}
        />
      )}
      {backgroundPolicyOptions && onBackgroundPolicyChange && (
        <Select
          className="ag-filter-field"
          data={backgroundPolicyOptions}
          value={backgroundPolicy ?? "all"}
          onChange={(value) => onBackgroundPolicyChange(value ?? "all")}
        />
      )}
    </Group>
  );
}
