import React from "react";
import {
  Badge,
  Card,
  Divider,
  Grid,
  Group,
  List,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";

import { useSearchParams } from "react-router-dom";

import { useHelpTopics } from "../hooks/useHelpTopics";

export function HelpPage() {
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get("topic");

  const {
    search,
    setSearch,
    category,
    setCategory,
    selectedTopicId,
    setSelectedTopicId,
    categories,
    filteredTopics,
    selectedTopic
  } = useHelpTopics({ topicParam });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Help Center</Title>
          <Text c="dimmed">Search by topic, then drill into the details.</Text>
        </div>
        <Badge variant="light" color="cyan">
          {filteredTopics.length} topics
        </Badge>
      </Group>

      <Card withBorder radius="md">
        <Group>
          <TextInput
            placeholder="Search help topics"
            value={search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
        </Group>
      </Card>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder radius="md" p="md" style={{ height: "100%" }}>
            <Stack gap="xs">
              <Text fw={600}>Categories</Text>
              {categories.map((name) => (
                <NavLink
                  key={name}
                  label={name}
                  active={category === name}
                  onClick={() => setCategory(name)}
                />
              ))}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder radius="md" p="md" style={{ height: "100%" }}>
            <Stack gap="xs" style={{ height: "100%" }}>
              <Text fw={600}>Topics</Text>
              <ScrollArea h={420}>
                <Stack gap={6}>
                  {filteredTopics.map((topic) => (
                    <NavLink
                      key={topic.id}
                      label={topic.title}
                      description={topic.summary}
                      active={topic.id === selectedTopicId}
                      onClick={() => setSelectedTopicId(topic.id)}
                    />
                  ))}
                  {filteredTopics.length === 0 && (
                    <Text size="sm" c="dimmed">
                      No topics match your search. Try fewer keywords.
                    </Text>
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="md" p="md" style={{ height: "100%" }}>
            {selectedTopic ? (
              <Stack gap="md">
                <Group justify="space-between">
                  <Badge variant="light" color="neon">
                    {selectedTopic.category}
                  </Badge>
                </Group>
                <div>
                  <Title order={3}>{selectedTopic.title}</Title>
                  <Text c="dimmed">{selectedTopic.summary}</Text>
                </div>
                <Divider />
                <Stack gap="sm">
                  {selectedTopic.details.map((detail, index) => (
                    <Text key={`${selectedTopic.id}-detail-${index}`}>{detail}</Text>
                  ))}
                </Stack>
                {selectedTopic.steps && (
                  <div>
                    <Text fw={600} mb={6}>
                      Steps
                    </Text>
                    <List withPadding>
                      {selectedTopic.steps.map((step) => (
                        <List.Item key={`${selectedTopic.id}-step-${step}`}>{step}</List.Item>
                      ))}
                    </List>
                  </div>
                )}
                {selectedTopic.bullets && (
                  <div>
                    <Text fw={600} mb={6}>
                      Tips
                    </Text>
                    <List withPadding>
                      {selectedTopic.bullets.map((bullet) => (
                        <List.Item key={`${selectedTopic.id}-bullet-${bullet}`}>{bullet}</List.Item>
                      ))}
                    </List>
                  </div>
                )}
              </Stack>
            ) : (
              <Stack>
                <Title order={3}>Choose a topic</Title>
                <Text c="dimmed">Select a category or search to see more details.</Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
