# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- "My Family" tool: an A4 sheet that fits the screen (landscape on wide screens, portrait on phones) with circles, squares, rectangles and triangles added by buttons and dragged by finger or mouse; 13 colours, size and rotation, five textures, layer order, duplicate and delete; undo / redo; the drawing is saved on the device automatically; Save to a file / Open from a file (JSON); download as PNG, SVG or PDF. Open it alone with `?only=my-family`.
- Family Studio shell: a slim top bar with the site name, tool tabs, `?tool=` and `?only=` links, one language switch shared by the tools and a "Data" menu with "Erase all my data".
- End-to-end tests for the tabs (switching, address, page title, reload), `?only=my-family`, erasing both tools (including a save still pending, and after waiting), saving failures, a dialog closed during a slow download, an emptied sheet behind the download dialog, a replaced drawing not coming back after a reload, and no external requests while adding, dragging, opening the download dialog and saving.
- "My Family" file menu and downloads: "File" offers New drawing, Save to a file (JSON, `moya-semya.json`) and Open from a file (replaces the drawing after confirmation; a crest file, a damaged file or one over 5 MB is refused with a message and nothing changes; the same file can be opened twice); "Download" opens a dialog with PNG (1240 x 1753, or 1753 x 1240 for a landscape sheet), SVG or PDF (A4 in the sheet's orientation), disabled with a note for an empty sheet, busy while working and showing an error message without closing on failure. The menu closes with Escape or a click outside it.
- "My Family" shape properties: when a shape is selected, the panel offers 13 colours (named, with a visible chosen state and a framed white), size and rotation sliders (rotation in steps of 15 degrees), five textures with previews or "Plain", Up / Down / To front / To back, Duplicate and Delete. Dragging a slider is one undo step.
- "My Family" saves the last change at once when the page is hidden or closed (`pagehide`, tab switch), instead of waiting for the 400 ms pause; Backspace also deletes the selected shape.
- "My Family" tool, a second tool in the shell: an A4 sheet that fits the screen (landscape on wide screens, portrait on phones) where circles, squares, rectangles and triangles are added with buttons and dragged with a finger or mouse; arrows move the selected shape (Shift for bigger steps), Delete removes it, Ctrl+Z / Ctrl+Y undo and redo, "Previous / Next shape" reach even a fully covered shape, "New drawing" starts over, and the drawing is saved on the device automatically. The groundwork from the earlier tasks (document history store, sheet model, validated autosave and file format, SVG renderer, SVG/PNG/PDF export code) is part of this tool.
- "Data" menu in the shell bar with "Erase all my data": after confirmation it wipes what every tool stored on this device and warns if the browser blocked part of it.
- Family Studio shell: a slim top bar with the site name, a tool registry, tool tabs (hidden with a single tool) and one language switch shared by all tools; the browser tab title follows the language and the tool ("Family crest — Family Studio").
- Internal address routing helper: `?tool=<id>` picks the tool, `?only=<id>` shows just that tool without tabs; unknown values fall back to the first available tool.
- Shell tests: unit tests for routing, the erase-all helper and crest data erasure, and end-to-end tests for the bar, `?only=`, the page title and the erase-all menu.
- Internal wipe-all helper that erases the data of every tool, continuing past a tool whose storage is blocked.
- Repository created by merging `family-crest` (history kept at the root) and `family-map` (history imported under `legacy/family-map`).

### Changed
- "My Family": "New drawing" moved from the top bar into the "File" menu (it still asks before replacing a drawing that has shapes). The 5 MB file limit now lives in one shared constant used by both tools.
- The default tool is now My Family (it is registered before the family crest); the crest opens with `?tool=crest`, and its end-to-end tests do the same.
- The family crest editor now lives inside the shell; its language switch moved from the editor header and the start screen to the shell bar.
- Project renamed to Family Studio: package name, site base path (`/family-studio/`), README and source link.
- Browser storage keys, the project file marker (`family-crest`) and downloaded file names are intentionally unchanged, so crests saved before the merge still open.

### Fixed
- "My Family": starting a new drawing, or opening a file that has no shapes, now erases the stored drawing and cancels a pending save at once, so a reload can never bring the replaced drawing back.
- "My Family" download dialog: the "Download" button and the "sheet is empty" note follow the sheet while the dialog is open (Ctrl+Z or Delete behind it can empty the sheet), and the sheet is read again when the download starts, so a blank sheet is never exported.
- "My Family" download dialog: closing it while a PNG or PDF is being made no longer downloads the file afterwards or shows a "done" message.
- "My Family": "Save to a file" shows the error message when the browser cannot create the file, like the download dialog does.
- Switching to a tool id that is not registered (for example `genogram`) is ignored: the tool and the address stay as they were.
- "My Family" undo and redo shortcuts (Ctrl/Cmd+Z, Ctrl+Y, Ctrl+Shift+Z) now work on a Russian keyboard layout too, without breaking QWERTZ, AZERTY or Dvorak (the typed Latin letter wins; other browser shortcuts such as Ctrl+F are left alone).
- "My Family" on phones: the sheet no longer changes size when a shape gets selected (the panel has a fixed height and scrolls), so a shape grabbed by a finger does not jump.
- "My Family" Ctrl+Z, Delete and Backspace keep working after a slider was touched; arrow keys stay with the slider.
- "My Family" two quick drags of the same shape are two undo steps, and a drag whose end event never arrived no longer blocks the next one.
- Erasing data from the shell now cancels a pending crest autosave, so the erased crest is not written back to the device a moment later (new `resetDoc()` in the crest store).
