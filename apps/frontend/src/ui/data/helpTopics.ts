export type HelpTopic = {
  id: string;
  category: string;
  title: string;
  summary: string;
  details: string[];
  bullets?: string[];
  steps?: string[];
  keywords?: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started-first-project",
    category: "Getting Started",
    title: "Start here: create your first project",
    summary: "Projects hold catalogs, specs, assets, and job history.",
    details: [
      "A project is the workspace boundary for a single game or collection. It owns catalogs, SpecLists, AssetSpecs, assets, and jobs.",
      "Use short, unique names so the data folder stays readable."
    ],
    steps: ["Create a project", "Create a SpecList", "Refine into AssetSpecs", "Queue jobs", "Review + approve assets"],
    keywords: ["project", "workspace", "setup", "onboarding"]
  },
  {
    id: "workflow-specs",
    category: "Workflow",
    title: "SpecList → AssetSpec flow",
    summary: "SpecLists are human-friendly. AssetSpecs are structured, generation-ready records.",
    details: [
      "SpecLists capture ideas quickly, while AssetSpecs are the precise definitions used by the pipeline.",
      "Refine a SpecList to produce multiple AssetSpecs with consistent structure.",
      "Asset types come from the project catalog and drive templates + defaults."
    ],
    bullets: ["SpecLists = brainstorming and quick edits", "AssetSpecs = structured prompts + metadata", "Refine when you are happy with the list"],
    keywords: ["speclist", "assetspec", "refine"]
  },
  {
    id: "workflow-generation",
    category: "Workflow",
    title: "Generation jobs",
    summary: "Jobs turn AssetSpecs into variants you can review.",
    details: [
      "Generation jobs use the selected checkpoint, template, and tags to render prompts.",
      "Each job can produce multiple variants so you can compare quality quickly."
    ],
    bullets: [
      "Use small batches while tuning prompts",
      "Check job logs if outputs look wrong",
      "Queue from Specs once prompts look good"
    ],
    keywords: ["jobs", "generate", "variants", "queue"]
  },
  {
    id: "review-variants",
    category: "Workflow",
    title: "Reviewing variants",
    summary: "Pick a primary variant and tag it for training or export.",
    details: [
      "Variants are alternative outputs for the same AssetSpec. One should become the primary for export.",
      "Use status and tags to keep review decisions searchable and consistent."
    ],
    bullets: [
      "Approve the best variant",
      "Reject low-quality outputs",
      "Set a primary for exports",
      "Use ratings to compare quality quickly"
    ],
    keywords: ["review", "approve", "reject", "primary"]
  },
  {
    id: "ratings-and-status",
    category: "Workflow",
    title: "Ratings and status strategy",
    summary: "Use status + ratings to keep review consistent and searchable.",
    details: [
      "Status is the decision (candidate/selected/rejected). Ratings capture subjective quality within a status.",
      "Use ratings to compare candidates before final selection.",
      "Version status tracks the lifecycle of a full asset version (draft → review → approved)."
    ],
    bullets: [
      "Use 4–5 for near-keepers",
      "Reject quickly and move on",
      "Set primary after selecting the winner",
      "Add short review notes for later audit"
    ],
    keywords: ["ratings", "status", "review"]
  },
  {
    id: "tags-and-catalogs",
    category: "Data & Metadata",
    title: "Tags and catalogs",
    summary: "Tags power search, training filters, and governance.",
    details: [
      "Catalogs define the allowed tags, styles, and asset types for your project.",
      "Use consistent tag prefixes like quality:*, style:*, usage:* so filters stay clean."
    ],
    bullets: [
      "Keep tags short and specific",
      "Use exclusive groups where needed",
      "Document new tags in the catalog",
      "Use filters to narrow review batches"
    ],
    keywords: ["tags", "catalogs", "metadata"]
  },
  {
    id: "chained-jobs",
    category: "Workflow",
    title: "Chained jobs (generate → post-process → export)",
    summary: "Queue follow-up jobs automatically after generation.",
    details: [
      "Chained jobs let you enqueue background removal, atlas packing, or export immediately after generation.",
      "Placeholders like $output.assetId and $projectId are replaced when the chain runs."
    ],
    bullets: ["Use for batch post-processing", "Keep chains short while debugging"],
    keywords: ["chained", "jobs", "pipeline", "placeholders"]
  },
  {
    id: "background-removal",
    category: "Workflow",
    title: "Background removal (alpha)",
    summary: "Remove backgrounds for clean sprites and exports.",
    details: [
      "Background removal is a worker stage that writes alpha masks and updated variants.",
      "Use it after approving a variant so the cleaned asset is the one you export.",
      "Parameters like threshold, feather, and erode help tune edge quality."
    ],
    bullets: [
      "Preview alpha before exporting",
      "Batch jobs once filters are set",
      "Store params for reproducibility",
      "Reset to defaults when testing new assets"
    ],
    keywords: ["alpha", "background", "mask"]
  },
  {
    id: "atlas-and-animation",
    category: "Workflow",
    title: "Atlases and animations",
    summary: "Pack frames into atlases and define animations before export.",
    details: [
      "Atlas packing groups frames into a spritesheet plus metadata.",
      "Animation metadata defines ordering, fps, and loop behavior for engines.",
      "Use padding/max size settings to control packing constraints.",
      "Edit pivot/origin points to align animations.",
      "Trim/extrude and POT help reduce artifacts in engine import."
    ],
    bullets: [
      "Use consistent frame naming",
      "Keep atlas settings deterministic",
      "Preview atlas frames before exporting",
      "Sort order can improve packing density"
    ],
    keywords: ["atlas", "animation", "spritesheet"]
  },
  {
    id: "exports-pixi",
    category: "Exports",
    title: "Pixi kit exports",
    summary: "Exports produce a Pixi kit folder with images, atlases, and a manifest.",
    details: [
      "The Pixi preview page loads the exported manifest to validate visuals.",
      "Map animations to atlases and UI states to texture keys before exporting.",
      "Warnings highlight missing mappings; unmapped items are skipped.",
      "Keep export profiles consistent so builds are reproducible."
    ],
    bullets: [
      "Export after variants are approved",
      "Verify in Pixi preview before shipping",
      "Use the manifest path from the export folder"
    ],
    keywords: ["export", "pixi", "kit"]
  },
  {
    id: "export-profiles",
    category: "Exports",
    title: "Export profiles",
    summary: "Profiles apply scale/trim/padding and naming rules to exports.",
    details: [
      "Profiles make exports reproducible by bundling naming + sizing rules.",
      "Scale/trim/padding apply to single images; atlas images are scaled and renamed.",
      "Use prefix/suffix to align with your runtime naming conventions."
    ],
    bullets: ["Save profiles per project", "Apply the same profile for all builds", "Update profiles when engine needs change"],
    keywords: ["profiles", "export", "naming", "scale"]
  },
  {
    id: "training-basics",
    category: "Training",
    title: "Training basics (LoRA)",
    summary: "Training uses curated, tagged assets to build style or asset-type models.",
    details: [
      "Training requires consistent tags, clean backgrounds, and approved variants.",
      "Use datasets that match the target checkpoint and style scope."
    ],
    bullets: ["Avoid mixed styles in one dataset", "Capture usage + quality tags for filtering"],
    keywords: ["training", "lora", "dataset"]
  },
  {
    id: "system-status",
    category: "Troubleshooting",
    title: "System status and ComfyUI checks",
    summary: "The Overview panel verifies ComfyUI reachability and weights.",
    details: [
      "If ComfyUI is down, generation will fail before any assets are created.",
      "Use the ComfyUI verification panel to see missing nodes or packages."
    ],
    bullets: [
      "Check logs for missing nodes",
      "Verify pythonBin and manifest settings",
      "Refresh logs after a failed job"
    ],
    keywords: ["comfyui", "system status", "verification"]
  },
  {
    id: "logs-and-debugging",
    category: "Troubleshooting",
    title: "Logs and debugging",
    summary: "Logs explain job failures and configuration issues.",
    details: [
      "The Jobs page shows per-job input, output, and log file tails.",
      "System logs provide backend and worker diagnostics."
    ],
    bullets: ["Refresh logs to see new errors", "Check inputs to confirm placeholders resolved"],
    keywords: ["logs", "debug", "errors"]
  },
  {
    id: "filters-and-bulk-actions",
    category: "Workflow",
    title: "Filters and bulk actions",
    summary: "Use filters to target batches, then apply bulk updates.",
    details: [
      "Filters narrow the list to specific tags, status, or asset types.",
      "Bulk actions let you approve, reject, tag, or regenerate multiple assets at once."
    ],
    bullets: [
      "Select all filtered to act on a batch",
      "Clear filters to return to the full list",
      "Save filters to reuse review queues"
    ],
    keywords: ["filters", "bulk", "selection"]
  },
  {
    id: "workflow-automation",
    category: "Workflow",
    title: "Workflow automation",
    summary: "Automate multi-step tasks with rules, triggers, and actions.",
    details: [
      "Automation rules let you chain jobs after key events (asset approval, atlas ready, schedule).",
      "Start with safe presets and use dry-runs to verify expected behavior.",
      "Rules should be scoped per project and avoid re-triggering on the same asset repeatedly."
    ],
    bullets: [
      "Use dry-run before enabling rules",
      "Prefer explicit triggers and limited actions",
      "Check run history after changes"
    ],
    keywords: ["automation", "rules", "workflow", "scheduler"]
  },
  {
    id: "data-layout",
    category: "Data & Metadata",
    title: "Data layout on disk",
    summary: "Everything is stored in `data/` JSON files for clarity and version control.",
    details: [
      "Projects, specs, assets, and jobs are persisted as JSON so you can diff changes easily.",
      "Use the migration tools when renaming tags or IDs."
    ],
    bullets: ["Run `npm run validate:data` after edits", "Use the ID governance rules"],
    keywords: ["data", "json", "schemas", "migrations"]
  },
  {
    id: "admin-console",
    category: "Admin",
    title: "Admin console",
    summary: "Manage catalogs, checkpoints, LoRAs, and export profiles.",
    details: [
      "Use the Admin page to edit catalog JSON, create checkpoints, and manage LoRA recommendations.",
      "Changes are validated against schemas, so keep JSON structure intact."
    ],
    bullets: ["Load before editing", "Save only valid JSON", "Refresh after updates"],
    keywords: ["admin", "catalogs", "checkpoints", "governance"]
  }
];
