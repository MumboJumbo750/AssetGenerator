import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createExportProfile,
  listAtlases,
  listExportProfiles,
  updateExportProfile,
  type AtlasRecord,
  type ExportProfile
} from "../api";

const DEFAULT_PROFILE: ExportProfile["options"] = {
  scale: 1,
  trim: false,
  padding: 0,
  namePrefix: "",
  nameSuffix: ""
};

export function useExportProfiles(projectId: string) {
  const [profiles, setProfiles] = useState<ExportProfile[]>([]);
  const [atlases, setAtlases] = useState<AtlasRecord[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("");
  const [profileScale, setProfileScale] = useState(1);
  const [profileTrim, setProfileTrim] = useState(false);
  const [profilePadding, setProfilePadding] = useState(0);
  const [profilePrefix, setProfilePrefix] = useState("");
  const [profileSuffix, setProfileSuffix] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const profileOptions = useMemo(
    () => ({
      scale: profileScale,
      trim: profileTrim,
      padding: profilePadding,
      namePrefix: profilePrefix,
      nameSuffix: profileSuffix
    }),
    [profileScale, profileTrim, profilePadding, profilePrefix, profileSuffix]
  );

  const refreshProfiles = useCallback(async () => {
    if (!projectId) return;
    const { profiles } = await listExportProfiles(projectId);
    setProfiles(profiles);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([listExportProfiles(projectId), listAtlases(projectId)])
      .then(([profilesRes, atlasRes]) => {
        setProfiles(profilesRes.profiles);
        setAtlases(atlasRes.atlases);
        if (!selectedProfileId && profilesRes.profiles[0]) setSelectedProfileId(profilesRes.profiles[0].id);
      })
      .catch((e: any) => {
        setProfileError(e?.message ?? String(e));
        setAtlasError(e?.message ?? String(e));
      });
  }, [projectId, selectedProfileId]);

  useEffect(() => {
    if (!selectedProfile) return;
    setProfileName(selectedProfile.name);
    setProfileScale(Number(selectedProfile.options?.scale ?? DEFAULT_PROFILE.scale));
    setProfileTrim(Boolean(selectedProfile.options?.trim ?? DEFAULT_PROFILE.trim));
    setProfilePadding(Number(selectedProfile.options?.padding ?? DEFAULT_PROFILE.padding));
    setProfilePrefix(String(selectedProfile.options?.namePrefix ?? DEFAULT_PROFILE.namePrefix ?? ""));
    setProfileSuffix(String(selectedProfile.options?.nameSuffix ?? DEFAULT_PROFILE.nameSuffix ?? ""));
  }, [selectedProfile?.id]);

  const createProfile = useCallback(async () => {
    if (!projectId) return;
    setProfileError(null);
    try {
      const created = await createExportProfile(projectId, {
        name: profileName || "Pixi Kit Profile",
        type: "pixi_kit",
        options: profileOptions
      });
      await refreshProfiles();
      setSelectedProfileId(created.id);
    } catch (e: any) {
      setProfileError(e?.message ?? String(e));
    }
  }, [projectId, profileName, profileOptions, refreshProfiles]);

  const updateProfile = useCallback(async () => {
    if (!projectId || !selectedProfile) return;
    setProfileError(null);
    try {
      await updateExportProfile(projectId, selectedProfile.id, {
        name: profileName,
        options: profileOptions
      });
      await refreshProfiles();
    } catch (e: any) {
      setProfileError(e?.message ?? String(e));
    }
  }, [projectId, profileName, profileOptions, refreshProfiles, selectedProfile]);

  return {
    profiles,
    atlases,
    profileError,
    atlasError,
    selectedProfileId,
    setSelectedProfileId,
    profileName,
    profileScale,
    profileTrim,
    profilePadding,
    profilePrefix,
    profileSuffix,
    setProfileName,
    setProfileScale,
    setProfileTrim,
    setProfilePadding,
    setProfilePrefix,
    setProfileSuffix,
    selectedProfile,
    profileOptions,
    refreshProfiles,
    createProfile,
    updateProfile
  };
}
