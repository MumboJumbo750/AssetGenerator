import React from "react";
import { Group, Stack, Text, Title } from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import { useComfyVerify } from "../hooks/useComfyVerify";
import { useOnboardingStep } from "../hooks/useOnboardingStep";
import { ComfyVerifyPanel } from "./overview/ComfyVerifyPanel";
import { GettingStartedPanel } from "./overview/GettingStartedPanel";
import { OnboardingPanel } from "./overview/OnboardingPanel";
import { OverviewMetricsPanel } from "./overview/OverviewMetricsPanel";
import { OverviewNextPanel } from "./overview/OverviewNextPanel";

export function OverviewPage() {
  const { specLists, specs, assets, jobs } = useAppData();
  const { verify, verifyError, verifyReady, runVerify, loading } = useComfyVerify();

  const onboardingStep = useOnboardingStep({
    verifyReady,
    specListsCount: specLists.length,
    specsCount: specs.length,
    jobsCount: jobs.length,
    assetsCount: assets.length
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={3}>Project overview</Title>
        <HelpTip label="Project setup and first-run flow." topicId="getting-started-first-project" />
        <Text c="dimmed">Checkpoint C: spec → generate → review → export</Text>
      </Group>
      <OverviewMetricsPanel
        specListsCount={specLists.length}
        specsCount={specs.length}
        assetsCount={assets.length}
        jobsCount={jobs.length}
      />
      <OverviewNextPanel message="Refine SpecLists into AssetSpecs, then queue generation jobs and review variants." />
      <GettingStartedPanel />
      <OnboardingPanel activeStep={onboardingStep} verifyLoading={loading} onVerify={runVerify} />
      <ComfyVerifyPanel verify={verify} verifyError={verifyError} verifyLoading={loading} onVerify={runVerify} />
    </Stack>
  );
}
