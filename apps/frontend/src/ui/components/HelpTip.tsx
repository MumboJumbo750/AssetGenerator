import React from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { Link } from "react-router-dom";

export function HelpTip({ label, topicId }: { label: string; topicId?: string }) {
  const target = topicId ? `/help?topic=${encodeURIComponent(topicId)}` : undefined;
  if (target) {
    return (
      <Tooltip label={label} position="top" withArrow>
        <ActionIcon component={Link} to={target} variant="subtle" color="cyan" size="sm" aria-label="Help">
          ?
        </ActionIcon>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={label} position="top" withArrow>
      <ActionIcon variant="subtle" color="cyan" size="sm" aria-label="Help">
        ?
      </ActionIcon>
    </Tooltip>
  );
}
