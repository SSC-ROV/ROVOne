---
name: ROV Team Hub
description: A monday.com-style work board for the ROV team. Pale frame, white boards, full-bleed status cells.
colors:
  frame: "#f6f7fb"
  panel: "#ffffff"
  text: "#323338"
  muted: "#676879"
  line: "#e6e9ef"
  line-strong: "#d0d4e4"
  primary: "#0073ea"
  primary-hover: "#0060b9"
  primary-soft: "#cce5ff"
  search: "rgba(103, 104, 121, 0.1)"
  done: "#00c875"
  working: "#fdab3d"
  stuck: "#df2f4a"
  not-started: "#c4c4c4"
  not-started-text: "#323338"
  priority-low: "#579bfc"
  priority-medium: "#5559df"
  priority-high: "#401694"
  group-blue: "#579bfc"
  group-green: "#00c875"
  group-purple: "#a25ddc"
  group-orange: "#ff642e"
  group-yellow: "#ffcb00"
  mark: "#fe158a"
  on-color: "#ffffff"
  dark-frame: "#090a0c"
  dark-panel: "#121418"
  dark-hover: "#1c1f24"
  dark-text: "#f5f6f8"
  dark-muted: "#b7bad0"
typography:
  board-title:
    fontFamily: "Poppins, Noto Sans TC, Figtree, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: "30px"
    letterSpacing: "-0.1px"
  group-title:
    fontFamily: "Poppins, Noto Sans TC, Figtree, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "-0.1px"
  body:
    fontFamily: "Figtree, Noto Sans TC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22.5px"
    letterSpacing: "normal"
  cell:
    fontFamily: "Figtree, Noto Sans TC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "normal"
  rail:
    fontFamily: "Figtree, Noto Sans TC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "-0.33px"
rounded:
  button: "4px"
  card: "8px"
  panel: "16px"
  search: "999px"
  avatar: "999px"
spacing:
  row: "36px"
  topbar: "48px"
  sidebar: "240px"
  page: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-color}"
    rounded: "{rounded.button}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-color}"
    rounded: "{rounded.button}"
    height: "32px"
  status-done:
    backgroundColor: "{colors.done}"
    textColor: "{colors.on-color}"
    height: "36px"
  status-working:
    backgroundColor: "{colors.working}"
    textColor: "{colors.on-color}"
    height: "36px"
  status-stuck:
    backgroundColor: "{colors.stuck}"
    textColor: "{colors.on-color}"
    height: "36px"
  status-not-started:
    backgroundColor: "{colors.not-started}"
    textColor: "{colors.not-started-text}"
    height: "36px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
---

## Overview

ROV Team Hub is a bilingual work board for a student robotics team. The product UI follows monday.com's light work-management surface: a pale grey frame, a white board, and saturated status and priority cells that can be read down a column. Chinese copy falls back to Noto Sans TC because Figtree and Poppins do not cover CJK. The team name stays in the mark; the monday wordmark is not used.

Dark mode keeps the same structure with inverted neutrals. Status colors do not change between themes.

## Colors

The frame is `#f6f7fb`. Boards, cards, and the workspace list are `#ffffff`. Text is `#323338`. Secondary text and rail labels are `#676879`. Hairlines are `#e6e9ef`.

The only chrome accent is `#0073ea`, darkening to `#0060b9` on hover. The selected workspace row is `#cce5ff`. The workspace mark tile is `#fe158a` and is not a status.

Status and priority are full-bleed cells:

| Meaning | Color |
| --- | --- |
| Done, arrived, completed, available | `#00c875` |
| In progress, pending, active | `#fdab3d` |
| Late, rejected, stuck, maintenance | `#df2f4a` |
| Not started | `#c4c4c4` with `#323338` text |
| Priority low, approved | `#579bfc` |
| Priority medium, ordered | `#5559df` |
| Priority high | `#401694` |

Group names cycle `#579bfc`, `#00c875`, `#a25ddc`, `#ff642e`, `#ffcb00`.

Dark frame `#090a0c`, panel `#121418`, hover `#1c1f24`, text `#f5f6f8`, muted `#b7bad0`. Status hex values stay the same.

## Typography

Figtree is the UI face at 15px / 22.5px. Board titles use Poppins at 24px / 30px, weight 500, tracking -0.1px. Group names use Poppins at 18px / 24px, weight 500. Cells, tabs, and sidebar rows are 14px / 20px. Rail labels are 11px / 16px with -0.33px tracking. Noto Sans TC is the next family in every stack so Chinese renders in the same roles.

## Layout

Desktop shell is one 240px white sidebar, then the white board. The sidebar holds the team mark, the page list, and account plus logout at the bottom. The top bar is 48px tall on the frame color, with a centered search pill (max 400px) that opens the existing command palette.

Board tables are 36px rows with a 1px gap, a sticky first column, and horizontal scroll. Groups have a 6px colored left edge and a colored name. Under 768px the sidebar collapses into a left drawer opened from the top bar.

## Elevation & Depth

The product is flat. Boards sit on the frame by color change, not shadow. Panels use a 1px `#e6e9ef` border. Popovers and the item sheet use a light shadow only so they separate from the board. Do not add offset or layered shadows on cards.

## Shapes

Primary buttons are 4px radius and 32px tall. Kanban cards and number widgets are 8px. Settings, login, and approval panels are 16px. The search field is a full pill. People are circles. Status and priority cells are square and bleed to the cell edge.

## Components

**Shell.** One sidebar lists the pages once, with icon and label. The top bar has search, theme, language, and the signed-in avatar. Account and logout live at the bottom of that same sidebar.

**Board header.** Poppins title, optional subtitle, view tabs, filter row, and a blue primary action.

**Board group.** Colored name, count, collapse control, 6px left edge. An optional footer holds the add row.

**Status and priority cells.** Full-width color blocks with a centered 14px label. Clicking opens a popover of the same color blocks. Not-started grey uses dark text so the label stays readable. Every other status uses white text. Dates, people, and plain text are not color blocks.

**Person.** A colored initial avatar plus the name. Clicking opens the member list when the row is editable.

**Item sheet.** The existing task sheet, about 700px wide, with title, description, and checklist. There is no comment thread.

**Kanban.** Status columns on the frame color, solid colored headers, white 8px cards.

## Do's and Don'ts

Do use green, orange, red, and the priority blues only for the status or priority they name.

Do keep dates, people, money, and free text on the white cell.

Do keep the team name in the mark. Do not use the monday wordmark, agent artwork, or controls that have no behavior (bell, marketplace, automate, invite).

Do not restyle status colors in dark mode. Invert the neutrals only.

Do not put Chinese-only text in a face that lacks CJK. Figtree and Poppins always fall through to Noto Sans TC.
