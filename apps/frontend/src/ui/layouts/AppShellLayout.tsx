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
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { NavLink as RouterNavLink, Outlet, useLocation } from "react-router-dom";

import { createProject } from "../api";
import { useAppData } from "../context/AppDataContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", description: "Project status and next steps" },
  { to: "/specs", label: "Specs", description: "SpecLists → AssetSpecs" },
  { to: "/assets", label: "Assets", description: "Review & tagging" },
  { to: "/atlases", label: "Atlases", description: "Frames & animations" },
  { to: "/exports", label: "Exports", description: "Profiles & Pixi kits" },
  { to: "/training", label: "Training", description: "LoRA eval comparison" },
  { to: "/automation", label: "Automation", description: "Rule-based job orchestration" },
  { to: "/admin", label: "Admin", description: "Catalogs & governance" },
  { to: "/jobs", label: "Jobs", description: "Queue and logs" },
  { to: "/pixi", label: "Pixi", description: "Export preview" },
  { to: "/help", label: "Help", description: "FAQ and workflows" },
  { to: "/logs", label: "Logs", description: "Backend & worker" },
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

  const location = useLocation();
  const [newProjectName, setNewProjectName] = useState("");

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
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
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="md">
            <Title order={3}>AssetGenerator</Title>
            <Badge variant="light" color="indigo">
              Checkpoint J
            </Badge>
          </Group>
          <Group gap="md">
            <Select
              placeholder="Select project"
              data={projectOptions}
              value={selectedProjectId}
              onChange={(value: string | null) => setSelectedProjectId(value ?? "")}
              w={240}
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
          <Card withBorder radius="md" p="md">
            <Stack gap={6}>
              <Text fw={600}>System status</Text>
              {systemStatusError && <Text size="xs">status error: {systemStatusError}</Text>}
              {!systemStatus && !systemStatusError && <Text size="xs">Loading system status...</Text>}
              {systemStatus && (
                <>
                  <Group gap={6}>
                    <Badge color={systemStatus.seeded.astroduckDemo ? "green" : "yellow"} variant="light">
                      {systemStatus.seeded.astroduckDemo ? "Seeded" : "Not seeded"}
                    </Badge>
                    <Badge color={systemStatus.comfyui.ok ? "green" : "red"} variant="light">
                      ComfyUI {systemStatus.comfyui.ok ? "OK" : "Down"}
                    </Badge>
                    <Badge color={systemStatus.worker.ok ? "green" : "red"} variant="light">
                      Worker {systemStatus.worker.ok ? "OK" : "Down"}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Flow: Spec → Generate → Review → Alpha → Atlas → Export
                  </Text>
                </>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md">
            <Text fw={600} mb="xs">
              Navigation
            </Text>
            <Stack gap={4}>
              {NAV_ITEMS.map((view) => (
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

          <Card withBorder radius="md" p="md" style={{ flex: 1 }}>
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
