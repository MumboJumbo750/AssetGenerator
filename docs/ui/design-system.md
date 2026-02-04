# UI design system (cyberpunk / sci‑fi)

This document defines **tokens** and **element usage** for a cohesive cyberpunk UI.  
Use it as the source of truth for styling and future components.

## 1) Tokens (source of truth)

### Color tokens (CSS variables)
Defined in `apps/frontend/src/ui/styles.css`:

| Token | Purpose | Hex |
|---|---|---|
| `--ag-bg` | App background | `#05060d` |
| `--ag-bg-2` | Secondary background | `#0b0f1f` |
| `--ag-surface` | Card / panel surface | `#0f172a` |
| `--ag-surface-2` | Inputs / controls | `#121c3a` |
| `--ag-border` | Subtle borders | `#25315a` |
| `--ag-text` | Primary text | `#e6f0ff` |
| `--ag-muted` | Muted text | `#9fb0d9` |
| `--ag-accent` | Primary neon | `#7c4dff` |
| `--ag-accent-2` | Cyan neon | `#00e5ff` |
| `--ag-success` | Success | `#39ffb4` |
| `--ag-warning` | Warning | `#ffb454` |
| `--ag-danger` | Error | `#ff4d6d` |

### Glow tokens
| Token | Use |
|---|---|
| `--ag-glow` | Primary neon halo |
| `--ag-glow-cyan` | Secondary cyan halo |

### Mantine theme tokens
Defined in `apps/frontend/src/main.tsx`:
- `primaryColor`: `neon`
- `colors.neon`, `colors.cyan`, `colors.magenta`
- `fontFamily`: `"Space Grotesk", Inter, ...`
- Component style overrides for `Card`, `Button`, `NavLink`, `Select`, `TextInput`, `Textarea`, `NumberInput`

## 2) Element usage (rules of thumb)

### Layout
- **Use `AppShell`** for header + nav.
- **Navigation** = `NavLink` list (one per route).
- **Pages** use `Stack` for vertical rhythm, `SimpleGrid` for multi‑column.

### Cards / Panels
- Use `Card` for any grouped content (never raw `<div>` blocks).
- Keep `Card` titles at `Text fw={600}` or `Title order={4}`.
- Use `Divider` sparingly to separate sections.

### Buttons
- Primary action: `Button` default variant (neon).
- Secondary action: `variant="light"`.
- Destructive action: `color="red"` with `variant="light"`.

### Inputs
- Use `TextInput`, `Textarea`, `Select`, `NumberInput`.
- Avoid custom input styling; rely on theme tokens.
- Add **help tips** on critical fields using the `HelpTip` component.

### Badges / Status
- Use `Badge` for state indicators (seeded, OK/Down, error).
- Prefer `variant="light"` for subtle status tags.

### Logs & Debug Panels
- Use `pre.log` for log blocks and JSON previews.
- Always wrap logs in `ScrollArea`.

### Help tips (noob‑friendly)
- Use the `HelpTip` component: `apps/frontend/src/ui/components/HelpTip.tsx`.
- Place help next to section titles or the most error‑prone inputs.

### Visual rhythm
- Padding and spacing should be consistent:
  - Page spacing: `Stack gap="lg"`
  - Card spacing: `Stack gap="md"`

## 3) Accessibility and contrast
- Always keep text contrast high against surfaces.
- Use `Text c="dimmed"` for secondary content only.
- Don’t place neon colors on large text blocks.
