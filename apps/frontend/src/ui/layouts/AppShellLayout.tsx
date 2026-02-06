import React, { useMemo, useState } from "react";
import {
  AppShell,
  Badge,
  Button,
  Card,
  Group,
  NavLink,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { NavLink as RouterNavLink, Outlet, useLocation } from "react-router-dom";

import { createProject } from "../api";
import { useAppData } from "../context/AppDataContext";
import { useExpertMode } from "../context/ExpertModeContext";
import { AutopilotStatusBar } from "../components/AutopilotStatusBar";

const PRIMARY_NAV_ITEMS = [
  { to: "/pipeline", label: "Pipeline", description: "Kanban view of spec flow" },
  { to: "/dashboard", label: "Dashboard", description: "System health and activity" },
  { to: "/review", label: "Review", description: "Immersive decision mode" },
  { to: "/library", label: "Library", description: "Assets, atlases, and LoRAs" },
  { to: "/export", label: "Export", description: "Wizard and live preview" },
];

const SECONDARY_NAV_ITEMS = [
  { to: "/exceptions", label: "Exceptions", description: "Escalated failures and retries" },
  { to: "/trends", label: "Trends", description: "Quality trends and improvement" },
  { to: "/metrics", label: "Metrics", description: "Quality gates and release readiness" },
  { to: "/settings", label: "Settings", description: "Automation, admin, logs, help" },
];

export function AppShellLayout() {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    refreshProjectData,
    refreshProjects,
    systemStatus,
    systemStatusError,
    error,
    setError,
  } = useAppData();
  const { expertMode, toggleExpertMode } = useExpertMode();

  const location = useLocation();
  const [newProjectName, setNewProjectName] = useState("");

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );

  function isActive(path: string) {
    return location.pathname.startsWith(path);
  }

  async function onCreateProject() {
    setError(null);
    try {
      const project = await createProject(newProjectName);
      setNewProjectName("");
      await refreshProjects();
      setSelectedProjectId(project.id);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <AppShell padding="lg" header={{ height: 64 }} navbar={{ width: 300, breakpoint: "sm" }}>
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" className="ag-header-row">
          <Group gap="md">
            <Stack gap={0}>
              <Title order={3}>AssetGenerator</Title>
              <Text size="xs" c="dimmed">
                Pipeline Studio
              </Text>
            </Stack>
            <Badge variant="light" color="aurora">
              Checkpoint J
            </Badge>
          </Group>
          <Group gap="md" className="ag-header-controls">
            <AutopilotStatusBar />
            <Switch
              size="xs"
              label="Expert"
              checked={expertMode}
              onChange={() => toggleExpertMode()}
              className="ag-expert-toggle"
            />
            <Select
              placeholder="Select project"
              data={projectOptions}
              value={selectedProjectId}
              onChange={(value: string | null) => setSelectedProjectId(value ?? "")}
              w={{ base: 170, sm: 240 }}
              searchable
              nothingFoundMessage="No projects"
            />
            <Button
              variant="light"
              onClick={() => refreshProjectData().catch((e) => setError(e?.message ?? String(e)))}
            >
              Refresh
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Stack gap="md" h="100%">
          <Card withBorder radius="md" p="md" className="ag-card-tier-2">
            <Stack gap={6}>
              <Text fw={600}>System status</Text>
              {systemStatusError && <Text size="xs">status error: {systemStatusError}</Text>}
              {!systemStatus && !systemStatusError && <Text size="xs">Loading system status...</Text>}
              {systemStatus && (
                <>
                  <Group gap={6}>
                    <Badge color={systemStatus.seeded.astroduckDemo ? "green" : "ember"} variant="light">
                      {systemStatus.seeded.astroduckDemo ? "Seeded" : "Not seeded"}
                    </Badge>
                    <Badge color={systemStatus.comfyui.ok ? "green" : "ember"} variant="light">
                      ComfyUI {systemStatus.comfyui.ok ? "OK" : "Down"}
                    </Badge>
                    <Badge color={systemStatus.worker.ok ? "green" : "ember"} variant="light">
                      Worker {systemStatus.worker.ok ? "OK" : "Down"}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Flow: Spec -&gt; Generate -&gt; Review -&gt; Alpha -&gt; Atlas -&gt; Export
                  </Text>
                </>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md" className="ag-card-tier-1">
            <Text fw={600} mb="xs">
              Navigation
            </Text>
            <Stack gap={4}>
              {PRIMARY_NAV_ITEMS.map((view) => (
                <NavLink
                  key={view.to}
                  component={RouterNavLink}
                  to={view.to}
                  label={view.label}
                  description={view.description}
                  active={isActive(view.to)}
                />
              ))}
              {SECONDARY_NAV_ITEMS.map((view) => (
                <NavLink
                  key={view.to}
                  component={RouterNavLink}
                  to={view.to}
                  label={view.label}
                  description={view.description}
                  active={isActive(view.to)}
                />
              ))}
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md" className="ag-card-tier-1" style={{ flex: 1 }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Projects</Text>
                <Badge variant="light">{projects.length}</Badge>
              </Group>
              <ScrollArea h={180}>
                <Stack gap={6}>
                  {projects.map((project) => (
                    <Button
                      key={project.id}
                      variant={project.id === selectedProjectId ? "filled" : "light"}
                      color={project.id === selectedProjectId ? "indigo" : "gray"}
                      justify="space-between"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <span>{project.name}</span>
                    </Button>
                  ))}
                  {projects.length === 0 && <Text size="xs">No projects yet. Create one or run `npm run seed`.</Text>}
                </Stack>
              </ScrollArea>
              <Group>
                <TextInput
                  placeholder="New project name"
                  value={newProjectName}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setNewProjectName(event.currentTarget.value)
                  }
                  style={{ flex: 1 }}
                />
                <Button onClick={onCreateProject} disabled={!newProjectName.trim()}>
                  Create
                </Button>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Stack gap="lg">
          {error && (
            <Card withBorder radius="md">
              <Text c="red">Error: {error}</Text>
            </Card>
          )}
          <Outlet />
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
