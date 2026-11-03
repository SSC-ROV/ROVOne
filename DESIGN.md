---
name: ROV Team Hub
description: A GitHub Projects-style work board for the ROV team. Navy canvas, grey hairlines, colour carried by status icons and outlined labels.
colors:
  # Dark (default theme)
  dark-canvas: "#010409"
  dark-surface: "#0d1117"
  dark-overlay: "#151b23"
  dark-muted: "#151b23"
  dark-border: "#3d444d"
  dark-text: "#f0f6fc"
  dark-text-muted: "#9198a1"
  dark-primary: "#238636"
  dark-accent: "#4493f8"
  dark-selected: "rgba(56, 139, 253, 0.15)"
  dark-underline: "#f78166"
  # Light
  canvas: "#f6f8fa"
  surface: "#ffffff"
  muted: "#eff2f5"
  border: "#d1d9e0"
  text: "#1f2328"
  text-muted: "#59636e"
  primary: "#1f883d"
  accent: "#0969da"
  selected: "#ddf4ff"
  underline: "#fd8c73"
  # Named colours (dark / light) — use through CSS variables --c-*
  green: "#3fb950 / #1a7f37"
  yellow: "#d29922 / #9a6700"
  purple: "#ab7df8 / #8250df"
  red: "#f85149 / #d1242f"
  orange: "#db6d28 / #bc4c00"
  blue: "#4493f8 / #0969da"
  gray: "#9198a1 / #59636e"
  pink: "#db61a2 / #bf3989"
  teal: "#39c5cf / #1b7c83"
typography:
  family: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans, Helvetica, Arial, Noto Sans TC, sans-serif"
  page-title: { fontSize: "24px", fontWeight: 600, lineHeight: "32px" }
  task-title: { fontSize: "26px", fontWeight: 400, lineHeight: "1.25" }
  group-title: { fontSize: "15px", fontWeight: 600 }
  body: { fontSize: "14px", lineHeight: "20px" }
  column-header: { fontSize: "12px", fontWeight: 600 }
  label: { fontSize: "12px", fontWeight: 500, height: "20px" }
rounded:
  control: "6px"
  card: "6px"
  label: "999px"
  avatar: "999px"
spacing:
  table-row: "37px"
  table-header: "32px"
  topbar: "48px"
  sidebar: "240px"
---

## Overview

ROV Team Hub is a bilingual work board for a student robotics team. It borrows the feel of GitHub Projects: a dark navy canvas, flat surfaces separated by grey hairlines, and colour used sparingly, mostly in small status icons and outlined label pills. The team's own name and mark stay in the sidebar; no third-party logos or wordmarks are used.

Dark is the default theme. Light mode keeps the same structure with a pale canvas and darker named colours so labels stay readable on white.

## Colours

All colours are CSS variables in `src/app/globals.css`, defined once per theme. Components never hard-code hex values; they use the shadcn tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary-soft`, …) or the named colours `var(--c-green)` … `var(--c-teal)`.

| Meaning | Colour |
| --- | --- |
| Todo / open | green |
| In progress | yellow |
| Done | purple |
| Overdue, destructive | red |
| Priority high | orange |
| Priority medium | yellow |
| Priority low | blue |
| Groups, subteams, avatars | cycle blue, green, purple, orange, pink, teal, yellow |
| Event types | meeting blue, water test teal, competition red, other gray |

The primary button is green (GitHub-style "New"). Links, focus rings, selection and active filters use the blue accent (`--primary-soft` background, `--primary-soft-foreground` text). The active quick-view tab has a coral underline (`--underline`).

## Typography

The system UI stack, with Noto Sans TC next so Chinese renders in the same roles. Body and table cells are 14px. Page titles are 24px semibold. The task title in the detail view is 26px regular with the `#number` in muted text after it. Column headers are 12px semibold muted.

## Components

**Status icon.** Drawn in `StatusIcon` (`src/components/board/ColorCell.tsx`): an open ring with a centre dot for Todo (green), a half-filled ring for In progress (yellow), and a filled circle with a check for Done (purple). Used before task titles, in group and column headers, in the timeline and on the calendar.

**Label.** `Label` / `.gh-label`: a 20px pill with a 1px border at 45% of the colour, a 14% fill, and text mixed toward the foreground. Status, priority, subteam and event type all use it. Clicking an editable label opens a small menu with a checkmark on the current value — never a bordered dropdown button inside a cell.

**Table.** One bordered card per group. The header shows chevron, icon or ring, bold name, a count pill, and an optional description. Rows are 37px with grid lines. The first column shows the row number, which turns into a checkbox on hover or when selected, then the status icon, the title and `#id`. An "Open" button slides in on row hover.

**Board.** Three status columns on the canvas colour with a 1px border; each header has the status icon, name, count pill and a one-line description. Cards show the status icon, project and `#id`, the assignee avatar, the title, and labels. Cards lift by 1px and gain a shadow on hover.

**Task detail.** A wide right-hand sheet laid out like an issue: title + number, a solid state badge, project chip and "opened … ago"; a description card; subtasks; an activity timeline (comments as bordered cards with an avatar on the rail, changes as one-line entries with an icon); and a comment box (Ctrl + Enter to send). The right sidebar has Assignee, Labels, a Project box with Status / Priority / Due / Subteam / Project fields, linked calendar events, and the completion date.

**Calendar.** Month grid with weekday headers, a blue circle for today, and up to three items per day (events as tinted chips with a coloured left edge, tasks with their status icon), then "+N more". Hover shows a "+" in the day; right-click opens a context menu (`src/components/ui/context-menu.tsx`) on days, events and tasks. Events can link to one task; the task's detail view lists its events and links back.

**People.** Tinted circular initials (`Avatar`). Names with a nickname, stored as "Nickname (Full Name)", show the nickname in tight spaces and the full name on hover.

## Motion

Short and functional: 150–300ms colour, opacity and transform transitions on hover; timeline entries and the day agenda fade in; sheets slide in. Everything respects `prefers-reduced-motion`.

## Do's and Don'ts

Do keep colour for meaning: state, priority, type, group. Surfaces stay neutral.

Do use theme tokens and `--c-*` variables, never raw hex, so both themes work.

Do give every right-click action a visible alternative (a button or a menu item elsewhere) for touch screens.

Don't use full-bleed coloured cells or coloured group titles.

Don't copy another product's logos, wordmarks or icon artwork; the status icons and labels here are our own drawings in a similar spirit.
