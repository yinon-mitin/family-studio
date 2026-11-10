# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Family Studio shell: a slim top bar with the site name, tool tabs (hidden with a single tool), a **Data** menu and one language switch shared by all tools. `?tool=<id>` picks the tool, `?only=<id>` shows just that tool without tabs; unknown values fall back to the first available tool. The tab title follows the language and the tool ("Family crest — Family Studio"), and the page description and the initial title describe the studio, not only the crest. On phones the bar's tabs, **Data** and the RU / EN buttons are at least 44 px tall, and on a narrow portrait phone the tabs take their own row; the Data menu closes with Escape or a press outside it.
- "Data → Erase all my data" in the shell bar: it asks in the site's own dialog (it also works where browsers block system dialogs), then wipes what every tool stored on this device, including the remembered language, checks that it is really gone and says so ("Data erased"), or names what could not be erased. A pending autosave is cancelled, so nothing is written back, and the crest's start screen no longer offers the erased crest.
- "My Family" tool, a second tool in the shell and the one that opens by default: an A4 sheet that fits the screen (landscape on wide screens, portrait on phones) where circles, squares, rectangles and triangles are added with buttons and dragged with a finger or mouse; arrows move the selected shape (Shift for bigger steps), Delete or Backspace removes it, Ctrl+Z / Ctrl+Y undo and redo (also on a Russian keyboard layout), "Previous / Next shape" reach even a fully covered shape, whose dashed selection ring is drawn above all shapes. Two quick drags are two undo steps. The drawing is saved on the device automatically, also at once when the page is hidden or closed. On phones the sheet keeps its size when a shape is selected (the panel has a fixed height and scrolls), and on a phone held sideways the panel sits beside the sheet. `?only=my-family` shows this tool alone.
- "My Family" shape properties: 13 named colours with a visible chosen state, size and rotation sliders (rotation in steps of 15 degrees; dragging a slider is one undo step), five textures with previews or "Plain", Up / Down / To front / To back, Duplicate and Delete.
- "My Family" file menu and downloads: "File" offers New drawing (asks before replacing a drawing that has shapes, and erases the stored one at once), Save to a file (JSON, `moya-semya.json`) and Open from a file (asks before replacing; a crest file, a damaged file or one over 5 MB is refused with a message and nothing changes). "Download" opens a dialog with PNG (1240 x 1753, or 1753 x 1240 for a landscape sheet), SVG or PDF (A4 in the sheet's orientation); it is disabled with a note for an empty sheet, shows progress and shows an error without closing when the file cannot be made. Closing the dialog during a slow export downloads nothing. The File menu closes with Escape or a press outside it.
- Repository created by merging `family-crest` (history kept at the root) and `family-map` (history imported under `legacy/family-map`).
- Tests: unit tests for the shell, the storage erase and the My Family modules, and end-to-end tests on desktop and phone for the shell, both tools and the exports, including that nothing but this site's own files is requested.

### Changed
- The site opens faster: the shell and "My Family" appear at once, and the crest's symbols and text fonts are loaded only when the "Family crest" tab is first opened; if they cannot be loaded, the message appears in that tab only.
- The default tool is now My Family (it is registered before the family crest); the crest opens with `?tool=crest`.
- The family crest editor now lives inside the shell; its language switch moved from the editor header and the start screen to the shell bar.
- Project renamed to Family Studio: package name, site base path (`/family-studio/`), README and source link.
- The page sends no referrer (`no-referrer`).
- Browser storage keys, the project file marker (`family-crest`) and downloaded file names are intentionally unchanged, so crests saved before the merge still open.
