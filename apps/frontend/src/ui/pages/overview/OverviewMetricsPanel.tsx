import React from "react";
import { Card, SimpleGrid, Text, Title } from "@mantine/core";

type Props = {
  specListsCount: number;
  specsCount: number;
  assetsCount: number;
  jobsCount: number;
};

export function OverviewMetricsPanel(props: Props) {
  return (
    <SimpleGrid cols={{ base: 1, md: 4 }}>
      <Card withBorder radius="md" p="md">
        <Text c="dimmed" size="xs">
          SpecLists
        </Text>
        <Title order={3}>{props.specListsCount}</Title>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text c="dimmed" size="xs">
          Specs
        </Text>
        <Title order={3}>{props.specsCount}</Title>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text c="dimmed" size="xs">
          Assets
        </Text>
        <Title order={3}>{props.assetsCount}</Title>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text c="dimmed" size="xs">
          Jobs
        </Text>
        <Title order={3}>{props.jobsCount}</Title>
      </Card>
    </SimpleGrid>
  );
}
