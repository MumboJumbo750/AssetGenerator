import React from "react";
import { Card, Stack, Text } from "@mantine/core";

type Props = {
  message: string;
};

export function OverviewNextPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Text fw={600}>Next</Text>
      <Text size="sm" c="dimmed">
        {props.message}
      </Text>
    </Card>
  );
}
