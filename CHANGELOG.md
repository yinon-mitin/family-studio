# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- "My Family" tool, a second tool in the shell: an A4 sheet that fits the screen (landscape on wide screens, portrait on phones) where circles, squares, rectangles and triangles are added with buttons and dragged with a finger or mouse; arrows move the selected shape (Shift for bigger steps), Delete removes it, Ctrl+Z / Ctrl+Y undo and redo, "Previous / Next shape" reach even a fully covered shape, "New drawing" starts over, and the drawing is saved on the device automatically. The groundwork from the earlier tasks (document history store, sheet model, validated autosave and file format, SVG renderer, SVG/PNG/PDF export code) is part of this tool.
- "Data" menu in the shell bar with "Erase all my data": after confirmation it wipes what every tool stored on this device and warns if the browser blocked part of it.
- Family Studio shell: a slim top bar with the site name, a tool registry, tool tabs (hidden with a single tool) and one language switch shared by all tools; the browser tab title follows the language and the tool ("Family crest — Family Studio").
- Internal address routing helper: `?tool=<id>` picks the tool, `?only=<id>` shows just that tool without tabs; unknown values fall back to the first available tool.
- Shell tests: unit tests for routing, the erase-all helper and crest data erasure, and end-to-end tests for the bar, `?only=`, the page title and the erase-all menu.
- Internal wipe-all helper that erases the data of every tool, continuing past a tool whose storage is blocked.
- Repository created by merging `family-crest` (history kept at the root) and `family-map` (history imported under `legacy/family-map`).

### Changed
- The default tool is now My Family (it is registered before the family crest); the crest opens with `?tool=crest`, and its end-to-end tests do the same.
- The family crest editor now lives inside the shell; its language switch moved from the editor header and the start screen to the shell bar.
- Project renamed to Family Studio: package name, site base path (`/family-studio/`), README and source link.
- Browser storage keys, the project file marker (`family-crest`) and downloaded file names are intentionally unchanged, so crests saved before the merge still open.

### Fixed
- Erasing data from the shell now cancels a pending crest autosave, so the erased crest is not written back to the device a moment later (new `resetDoc()` in the crest store).
