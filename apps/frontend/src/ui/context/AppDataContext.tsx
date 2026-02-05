import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  getAssetTypeCatalog,
  getTagCatalog,
  listAssets,
  listJobs,
  listProjects,
  listSpecLists,
  listSpecs,
  type Asset,
  type Job,
  type Project,
  type SpecList,
  type AssetSpec,
  type AssetTypeCatalog,
  type TagCatalog,
} from "../api";
import { fetchSystemStatus, type SystemStatus } from "../services/systemService";

type AppData = {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;

  specLists: SpecList[];
  selectedSpecListId: string;
  setSelectedSpecListId: (id: string) => void;

  specs: AssetSpec[];
  assets: Asset[];
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;

  jobs: Job[];
  selectedJobId: string;
  setSelectedJobId: (id: string) => void;

  systemStatus: SystemStatus | null;
  systemStatusError: string | null;

  tagCatalog: TagCatalog | null;
  tagCatalogError: string | null;

  assetTypeCatalog: AssetTypeCatalog | null;
  assetTypeCatalogError: string | null;

  refreshProjectData: (projectId?: string) => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  refreshTagCatalog: (projectId?: string) => Promise<void>;
  refreshAssetTypeCatalog: (projectId?: string) => Promise<void>;
  error: string | null;
  setError: (msg: string | null) => void;
};

const AppDataContext = createContext<AppData | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [specLists, setSpecLists] = useState<SpecList[]>([]);
  const [selectedSpecListId, setSelectedSpecListId] = useState("");

  const [specs, setSpecs] = useState<AssetSpec[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusError, setSystemStatusError] = useState<string | null>(null);

  const [tagCatalog, setTagCatalog] = useState<TagCatalog | null>(null);
  const [tagCatalogError, setTagCatalogError] = useState<string | null>(null);

  const [assetTypeCatalog, setAssetTypeCatalog] = useState<AssetTypeCatalog | null>(null);
  const [assetTypeCatalogError, setAssetTypeCatalogError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  async function refreshProjects() {
    const { projects } = await listProjects();
    setProjects(projects);
    if (!selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
  }

  async function refreshSystemStatus() {
    setSystemStatusError(null);
    try {
      const status = await fetchSystemStatus();
      setSystemStatus(status);
    } catch (e: any) {
      setSystemStatus(null);
      setSystemStatusError(e?.message ?? String(e));
    }
  }

  async function refreshTagCatalog(projectId = selectedProjectId) {
    if (!projectId) return;
    setTagCatalogError(null);
    try {
      const catalog = await getTagCatalog(projectId);
      setTagCatalog(catalog);
    } catch (e: any) {
      setTagCatalog(null);
      setTagCatalogError(e?.message ?? String(e));
    }
  }

  async function refreshAssetTypeCatalog(projectId = selectedProjectId) {
    if (!projectId) return;
    setAssetTypeCatalogError(null);
    try {
      const catalog = await getAssetTypeCatalog(projectId);
      setAssetTypeCatalog(catalog);
    } catch (e: any) {
      setAssetTypeCatalog(null);
      setAssetTypeCatalogError(e?.message ?? String(e));
    }
  }

  async function refreshProjectData(projectId = selectedProjectId) {
    if (!projectId) return;
    await refreshSystemStatus();
    await refreshTagCatalog(projectId);
    await refreshAssetTypeCatalog(projectId);
    const [{ specLists }, { specs }, { assets }, { jobs }] = await Promise.all([
      listSpecLists(projectId),
      listSpecs(projectId),
      listAssets(projectId),
      listJobs(projectId),
    ]);
    setSpecLists(specLists);
    setSelectedSpecListId((prev) => {
      if (specLists.length === 0) return "";
      if (prev && specLists.some((s) => s.id === prev)) return prev;
      return specLists[0].id;
    });
    setSpecs(specs);
    setAssets(assets);
    setSelectedAssetId((prev) => {
      if (assets.length === 0) return "";
      if (prev && assets.some((a) => a.id === prev)) return prev;
      return assets[0].id;
    });
    setJobs(jobs);
    setSelectedJobId((prev) => {
      if (jobs.length === 0) return "";
      if (prev && jobs.some((j) => j.id === prev)) return prev;
      return jobs[0].id;
    });
  }

  useEffect(() => {
    refreshProjects().catch((e) => setError(e?.message ?? String(e)));
  }, []);

  useEffect(() => {
    refreshProjectData().catch((e) => setError(e?.message ?? String(e)));
  }, [selectedProjectId]);

  useEffect(() => {
    refreshSystemStatus().catch((e) => setError(e?.message ?? String(e)));
    const t = window.setInterval(() => {
      refreshSystemStatus().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(t);
  }, []);

  const value = useMemo<AppData>(
    () => ({
      projects,
      selectedProjectId,
      setSelectedProjectId,
      refreshProjects,
      specLists,
      selectedSpecListId,
      setSelectedSpecListId,
      specs,
      assets,
      selectedAssetId,
      setSelectedAssetId,
      jobs,
      selectedJobId,
      setSelectedJobId,
      systemStatus,
      systemStatusError,
      tagCatalog,
      tagCatalogError,
      assetTypeCatalog,
      assetTypeCatalogError,
      refreshProjectData,
      refreshSystemStatus,
      refreshTagCatalog,
      refreshAssetTypeCatalog,
      error,
      setError,
    }),
    [
      projects,
      selectedProjectId,
      specLists,
      selectedSpecListId,
      specs,
      assets,
      selectedAssetId,
      jobs,
      selectedJobId,
      systemStatus,
      systemStatusError,
      tagCatalog,
      tagCatalogError,
      assetTypeCatalog,
      assetTypeCatalogError,
      error,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
