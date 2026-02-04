import { useEffect, useMemo, useState } from "react";

import { HELP_TOPICS, type HelpTopic } from "../data/helpTopics";

function matchesSearch(topic: HelpTopic, search: string) {
  if (!search) return true;
  const haystack = [
    topic.title,
    topic.summary,
    ...(topic.details ?? []),
    ...(topic.bullets ?? []),
    ...(topic.steps ?? []),
    ...(topic.keywords ?? [])
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export function useHelpTopics(opts: { topicParam: string | null }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(HELP_TOPICS.map((topic) => topic.category)))],
    []
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTopics = useMemo(
    () =>
      HELP_TOPICS.filter((topic) => (category === "All" ? true : topic.category === category)).filter((topic) =>
        matchesSearch(topic, normalizedSearch)
      ),
    [category, normalizedSearch]
  );

  useEffect(() => {
    if (opts.topicParam) {
      const topic = HELP_TOPICS.find((item) => item.id === opts.topicParam);
      if (topic) {
        setCategory(topic.category);
        setSelectedTopicId(topic.id);
        setSearch("");
      }
    }
  }, [opts.topicParam]);

  useEffect(() => {
    if (filteredTopics.length === 0) {
      setSelectedTopicId(null);
      return;
    }
    if (!selectedTopicId || !filteredTopics.find((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(filteredTopics[0].id);
    }
  }, [filteredTopics, selectedTopicId]);

  const selectedTopic =
    filteredTopics.find((topic) => topic.id === selectedTopicId) ??
    HELP_TOPICS.find((topic) => topic.id === selectedTopicId);

  return {
    search,
    setSearch,
    category,
    setCategory,
    selectedTopicId,
    setSelectedTopicId,
    categories,
    filteredTopics,
    selectedTopic
  };
}
