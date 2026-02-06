import React, { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";

import { useAppData } from "../../context/AppDataContext";
import { useExpertMode } from "../../context/ExpertModeContext";
import type { Job } from "../../api";

type EscalationFilter = "all" | "exception_inbox" | "decision_sprint" | "reject";
type SeverityFilter = "all" | "timeout" | "upstream_unavailable" | "retryable" | "non_retryable";
type SortField = "newest" | "oldest" | "type" | "errorClass";

function formatAge(dateStr: string): string {
  const ms = Date.now() - Date.parse(dateStr);
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

function errorClassColor(ec?: string): string {
  switch (ec) {
    case "timeout":
      return "yellow";
    case "upstream_unavailable":
      return "orange";
    case "retryable":
      return "blue";
    case "non_retryable":
      return "red";
    default:
      return "gray";
  }
}

function escalationColor(target?: string): string {
  switch (target) {
    case "exception_inbox":
      return "orange";
    case "decision_sprint":
      return "indigo";
    case "reject":
      return "red";
    default:
      return "gray";
  }
}

/**
 * ExceptionInbox — aggregates escalated/failed jobs for operator review.
 *
 * Features:
 *  - Filter by escalation target, error class, job type, text search
 *  - Sort by age, type, errorClass
 *  - Manual retry (re-queues the job)
 *  - Dismiss (marks as acknowledged)
 *  - Detail expand showing retry history
 *  - Expert mode shows additional metadata
 */
export function ExceptionInbox() {
  const { jobs, selectedProjectId, refreshProjectData, setError } = useAppData();
  const { expertMode } = useExpertMode();

  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("newest");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // All escalated jobs (failed with escalation info, or failed with retryHistory)
  const escalatedJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (j.status !== "failed") return false;
      // Include if explicitly escalated, or if it has retry history (was retried and still failed)
      return !!j.escalatedAt || !!j.escalationTarget || (j.retryHistory && j.retryHistory.length > 0);
    });
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let result = escalatedJobs;
    if (escalationFilter !== "all") {
      result = result.filter((j) => j.escalationTarget === escalationFilter);
    }
    if (severityFilter !== "all") {
      result = result.filter((j) => j.errorClass === severityFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (j) =>
          j.id.toLowerCase().includes(q) ||
          (j.error ?? "").toLowerCase().includes(q) ||
          j.type.toLowerCase().includes(q),
      );
    }
    // Sort
    result = [...result];
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case "oldest":
        result.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        break;
      case "type":
        result.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case "errorClass":
        result.sort((a, b) => (a.errorClass ?? "").localeCompare(b.errorClass ?? ""));
        break;
    }
    return result;
  }, [escalatedJobs, escalationFilter, severityFilter, searchText, sortBy]);

  const handleRetry = useCallback(
    async (job: Job) => {
      try {
        const resp = await fetch(`/api/projects/${selectedProjectId}/jobs/${job.id}/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!resp.ok) {
          // Fallback: manually re-queue by updating the job
          const updateResp = await fetch(`/api/projects/${selectedProjectId}/jobs/${job.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "queued" }),
          });
          if (!updateResp.ok) throw new Error(`Failed to retry job: ${updateResp.statusText}`);
        }
        await refreshProjectData();
      } catch (err: any) {
        setError(err?.message ?? String(err));
      }
    },
    [selectedProjectId, refreshProjectData, setError],
  );

  const handleDismiss = useCallback(
    async (job: Job) => {
      try {
        // Mark as canceled to dismiss from inbox
        const resp = await fetch(`/api/projects/${selectedProjectId}/jobs/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "canceled" }),
        });
        if (!resp.ok) throw new Error(`Failed to dismiss job: ${resp.statusText}`);
        await refreshProjectData();
      } catch (err: any) {
        setError(err?.message ?? String(err));
      }
    },
    [selectedProjectId, refreshProjectData, setError],
  );

  return (
    <Stack gap="md" className="ag-exception-inbox">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={3}>Exception Inbox</Title>
          <Badge variant="filled" color="orange" size="lg">
            {escalatedJobs.length}
          </Badge>
        </Group>
        <Button
          variant="light"
          size="sm"
          onClick={() => refreshProjectData().catch((e) => setError(e?.message ?? String(e)))}
        >
          Refresh
        </Button>
      </Group>

      {!selectedProjectId && (
        <Card withBorder p="lg">
          <Text c="dimmed">Select a project to view exceptions.</Text>
        </Card>
      )}

      {selectedProjectId && (
        <>
          <Card withBorder radius="md" p="sm" className="ag-exception-filters">
            <Group gap="sm" wrap="wrap">
              <SegmentedControl
                size="xs"
                value={escalationFilter}
                onChange={(v) => setEscalationFilter(v as EscalationFilter)}
                data={[
                  { label: "All", value: "all" },
                  { label: "Inbox", value: "exception_inbox" },
                  { label: "Sprint", value: "decision_sprint" },
                  { label: "Rejected", value: "reject" },
                ]}
              />
              <Select
                size="xs"
                placeholder="Error class"
                value={severityFilter}
                onChange={(v) => setSeverityFilter((v ?? "all") as SeverityFilter)}
                data={[
                  { label: "All classes", value: "all" },
                  { label: "Timeout", value: "timeout" },
                  { label: "Upstream unavailable", value: "upstream_unavailable" },
                  { label: "Retryable", value: "retryable" },
                  { label: "Non-retryable", value: "non_retryable" },
                ]}
                w={170}
                clearable={false}
              />
              <Select
                size="xs"
                placeholder="Sort"
                value={sortBy}
                onChange={(v) => setSortBy((v ?? "newest") as SortField)}
                data={[
                  { label: "Newest first", value: "newest" },
                  { label: "Oldest first", value: "oldest" },
                  { label: "By type", value: "type" },
                  { label: "By error class", value: "errorClass" },
                ]}
                w={140}
                clearable={false}
              />
              <TextInput
                size="xs"
                placeholder="Search errors..."
                value={searchText}
                onChange={(e) => setSearchText(e.currentTarget.value)}
                style={{ flex: 1, minWidth: 150 }}
              />
            </Group>
          </Card>

          {filteredJobs.length === 0 && (
            <Card withBorder p="xl" radius="md">
              <Stack align="center" gap="sm">
                <Text size="xl">All clear</Text>
                <Text c="dimmed" size="sm">
                  {escalatedJobs.length === 0
                    ? "No escalated jobs. The autopilot is handling everything."
                    : "No jobs match the current filters."}
                </Text>
              </Stack>
            </Card>
          )}

          {filteredJobs.length > 0 && (
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder className="ag-exception-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Job</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Error Class</Table.Th>
                    <Table.Th>Escalation</Table.Th>
                    <Table.Th>Attempts</Table.Th>
                    <Table.Th>Age</Table.Th>
                    <Table.Th>Error</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredJobs.map((job) => (
                    <React.Fragment key={job.id}>
                      <Table.Tr
                        style={{ cursor: "pointer" }}
                        onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                      >
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {job.id.slice(0, 10)}...
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light">
                            {job.type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color={errorClassColor(job.errorClass)}>
                            {job.errorClass ?? "unknown"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="filled" color={escalationColor(job.escalationTarget)}>
                            {job.escalationTarget ?? "none"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">
                            {job.attempt ?? 1}/{job.maxAttempts ?? "?"}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {formatAge(job.escalatedAt ?? job.updatedAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ maxWidth: 250 }}>
                          <Tooltip label={job.error ?? ""} multiline w={350}>
                            <Text size="xs" lineClamp={1}>
                              {job.error ?? "—"}
                            </Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Button
                              size="compact-xs"
                              variant="light"
                              color="blue"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetry(job);
                              }}
                            >
                              Retry
                            </Button>
                            <Button
                              size="compact-xs"
                              variant="light"
                              color="gray"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismiss(job);
                              }}
                            >
                              Dismiss
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>

                      {expandedJobId === job.id && (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Card withBorder p="sm" radius="sm" className="ag-exception-detail">
                              <Stack gap="xs">
                                <Group gap="md">
                                  <Text size="xs" fw={600}>
                                    Full Job ID:
                                  </Text>
                                  <Text size="xs" ff="monospace">
                                    {job.id}
                                  </Text>
                                </Group>
                                <Group gap="md">
                                  <Text size="xs" fw={600}>
                                    Created:
                                  </Text>
                                  <Text size="xs">{new Date(job.createdAt).toLocaleString()}</Text>
                                  <Text size="xs" fw={600}>
                                    Updated:
                                  </Text>
                                  <Text size="xs">{new Date(job.updatedAt).toLocaleString()}</Text>
                                </Group>
                                {job.escalatedAt && (
                                  <Group gap="md">
                                    <Text size="xs" fw={600}>
                                      Escalated at:
                                    </Text>
                                    <Text size="xs">{new Date(job.escalatedAt).toLocaleString()}</Text>
                                  </Group>
                                )}
                                <Text size="xs" fw={600}>
                                  Error:
                                </Text>
                                <Text size="xs" ff="monospace" style={{ whiteSpace: "pre-wrap" }}>
                                  {job.error}
                                </Text>

                                {job.retryHistory && job.retryHistory.length > 0 && (
                                  <>
                                    <Text size="xs" fw={600} mt="xs">
                                      Retry History:
                                    </Text>
                                    <Table withTableBorder>
                                      <Table.Thead>
                                        <Table.Tr>
                                          <Table.Th>Attempt</Table.Th>
                                          <Table.Th>Error Class</Table.Th>
                                          <Table.Th>Error</Table.Th>
                                          <Table.Th>Timestamp</Table.Th>
                                        </Table.Tr>
                                      </Table.Thead>
                                      <Table.Tbody>
                                        {job.retryHistory.map((entry, idx) => (
                                          <Table.Tr key={idx}>
                                            <Table.Td>
                                              <Text size="xs">#{entry.attempt}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Badge size="xs" color={errorClassColor(entry.errorClass)}>
                                                {entry.errorClass}
                                              </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                              <Text size="xs" lineClamp={2}>
                                                {entry.error}
                                              </Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Text size="xs" c="dimmed">
                                                {new Date(entry.ts).toLocaleString()}
                                              </Text>
                                            </Table.Td>
                                          </Table.Tr>
                                        ))}
                                      </Table.Tbody>
                                    </Table>
                                  </>
                                )}

                                {expertMode && (
                                  <>
                                    <Text size="xs" fw={600} mt="xs">
                                      Input (expert):
                                    </Text>
                                    <Text
                                      size="xs"
                                      ff="monospace"
                                      style={{ whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}
                                    >
                                      {JSON.stringify(job.input, null, 2)}
                                    </Text>
                                    {job.output && (
                                      <>
                                        <Text size="xs" fw={600}>
                                          Output (expert):
                                        </Text>
                                        <Text
                                          size="xs"
                                          ff="monospace"
                                          style={{ whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}
                                        >
                                          {JSON.stringify(job.output, null, 2)}
                                        </Text>
                                      </>
                                    )}
                                  </>
                                )}
                              </Stack>
                            </Card>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </React.Fragment>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </>
      )}
    </Stack>
  );
}
