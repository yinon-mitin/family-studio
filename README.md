# Family Studio

Tools for family work in psychology practice, in one site: the projective **"My Family"** drawing (ready, the tool that opens by default), a **family crest** builder (ready) and a **genogram** drawing tool (planned). The repository was created by merging two earlier projects, `family-crest` and `family-map`, with their full git history.

> **Status.** The site has a shell (top bar, tabs, tool registry, shared language switch, "erase all my data") with two tools: **My Family** (opens by default) and the **family crest** (`?tool=crest`). The genogram is not wired in yet. The original `family-map` editor lives unchanged in [`legacy/family-map`](legacy/family-map) until its parts are ported to the new shared application.

## My Family

A sheet of A4 where a client lays out coloured shapes to show their family, then downloads the result. The interface is made for working on one's own, with plain buttons and no jargon.

**Open it directly:** `?only=my-family` shows just this tool, with no tabs (`?tool=my-family` opens it with the tabs). It is also what the site opens by default.

- **Sheet.** A4 that fits the screen: landscape on a wide screen, portrait on a phone. It is drawn as SVG with a fixed coordinate space (1000 x 1414 units), so turning the device does not recreate it and an existing drawing keeps its orientation.
- **Shapes.** Circle, square, rectangle and triangle, up to 200 per drawing. Add them with buttons, drag them with a finger or mouse (they cannot leave the sheet), or move them with the arrow keys (Shift for bigger steps).
- **Properties** of the selected shape: 13 colours, size (30 to 260 units), rotation in steps of 15 degrees, five textures (stripes, checks, dots, waves, lozenges) or plain, and layer order (up, down, to front, to back). Duplicate and Delete are there too. "Previous / Next shape" reaches a shape that is fully covered by others.
- **Undo and redo:** `Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z` (also on a Russian keyboard layout) and buttons. Dragging a shape or a slider is one step.
- **File menu:** New drawing (asks before replacing a drawing that has shapes), Save to a file (`moya-semya.json`) and Open from a file (asks before replacing; a file that is not a My Family project, is damaged or is over 5 MB is refused and nothing changes).
- **Download:** PNG (1240 x 1753 px, A4 at 150 dpi), SVG or PDF (A4 in the sheet's orientation). The picture matches the screen: one function, `renderSheet`, draws the sheet for the screen and for every export.
- **Privacy.** Everything stays in the browser. The drawing is autosaved to this device's local storage (key `family-studio:my-family:autosave:v1`) a moment after each change and when the page is hidden or closed. Nothing is sent anywhere: no server, no analytics, no external requests. To erase it, use **Data → Erase all my data** in the top bar (this also erases the crest), or start a new drawing: a new or empty drawing is never stored. If the browser blocks local storage, the tool still works, it just cannot remember the drawing.

```
src/core/                     document history store (undo/redo), its Preact hook, the shared file size limit
src/tools/my-family/model.ts       the document and the actions on it (add, update, reorder, duplicate, delete)
src/tools/my-family/sheet.ts       sheet sizes and orientation
src/tools/my-family/persist.ts     validated save/open format and autosave
src/tools/my-family/files.ts       reading a project file
src/tools/my-family/render.ts      the sheet as an SVG string (screen and exports)
src/tools/my-family/exports.ts     PNG, SVG and PDF files
src/tools/my-family/exportFlow.ts  the download step: reads the current drawing, drops the result if the dialog was closed
src/tools/my-family/store.ts       the store: document with history, selection, toast, autosave
src/tools/my-family/Sheet.tsx      the sheet with draggable shapes
src/tools/my-family/Panel.tsx      shape properties
src/tools/my-family/FileMenu.tsx   File menu and the download dialog
src/tools/my-family/MyFamily.tsx   the tool: layout, buttons and keyboard shortcuts (shortcuts.ts)
```

## Family crest

An interactive family crest builder for group psychology practice. Participants put together a crest from lines of work, animals, nature, symbols, ornaments and colors, then download it as **PNG**, **PDF** or **SVG**.

**Live site:** https://yinon-mitin.github.io/family-studio/

The interface is available in **Russian** (default) and **English**. Switch with the RU / EN button in the corner; the choice is remembered in the browser, and `?lang=en` in the address opens the English version directly. The switch sits in the shell bar.

## The shell

The site is a thin shell around the tools: a slim top bar with the site name, tool tabs, a **Data** menu and the RU / EN switch, with the active tool below it. The language switch lives in the bar and is shared by all tools; the browser tab title follows the language and the tool ("Family crest — Family Studio").

- **Tool tabs** ("My Family", "Family crest") are shown when more than one tool is registered; `?only=` hides them. The first tab is the default tool.
- **Links.** `?tool=<id>` opens a given tool: `my-family` (the default) or `crest`. `genogram` is a reserved id that will work once that tool is wired (until then it falls back to the first tool). Switching tabs updates `?tool=` in the address without adding a history entry. `?only=<id>` shows just that tool with no tabs and wins over `?tool=`. A missing or unknown value never breaks the page: the first registered tool is shown. Other parameters such as `?lang=en` are kept, so `?only=my-family&lang=en` works.
- **Data → Erase all my data** asks for confirmation in the site's own dialog (Escape or Cancel erases nothing), then erases everything every registered tool keeps on the device, plus the remembered language (the page keeps its current language until it is reloaded). After erasing, each key is read back: when everything is gone a short "Data erased" message appears; when a key is still there or the browser blocks its storage, the message names what could not be erased (for example "My Family") and stays until it is closed, and the other tools are still erased. A save that was still waiting is cancelled so nothing is written back, and the crest start screen no longer offers the erased crest. The menu closes with Escape or a press outside it.
- **Limitations.** Data is per browser and per device. Erasing in one tab does not update another open tab of the same site until that tab is reloaded (an open tab can write its drawing back with its next change).

Tools are registered in `src/shell/tools.ts`; a tool is an id, a tab title, a component and a `clearData()` function.

```
src/shell/route.ts     resolveRoute (address to tool and tabs) and toolUrl
src/shell/tools.ts     the tool registry
src/shell/nav.ts       the current tool (kept in the address) and the useTool hook
src/shell/wipeAll.ts   erases the data of all targets, continuing past failures and keeping who failed and why
src/shell/wipeTargets.ts  what erase-all removes: each tool's data and the saved language
src/shell/ToolBar.tsx  top bar: name, tabs, Data menu, language switch
src/shell/Shell.tsx    bar plus the current tool, sets the page title
```

## Features

- **Two ways to start:** a blank sheet with complete freedom, or one of 8 templates. A template is an ordinary crest: everything in it can be changed or deleted.
- **Shield:** 8 shapes, 9 divisions into fields, 8 patterns, 12 colors (7 classic heraldic tinctures) and a custom color.
- **Catalog:** about 270 symbols in four categories (work, animals, nature, symbols) with search by name and meaning. Plus 12 ornaments (wreaths, crown, ribbon, rays, rings, frame, flourishes, stars, tree of life) and captions (straight, on an arc, on a banner).
- **Snapping to fields:** a template symbol sits in a field of the shield and re-fits itself when the shape or division changes, always staying inside its field. Dragging detaches a symbol; "Return to a field" snaps it back.
- **Controls:** drag, size and rotation handles, two-finger pinch, sliders and keyboard (arrows, `+`/`-`, `Delete`, `Ctrl+Z`/`Ctrl+Y`, `Ctrl+D`). Layers: order, hide, lock, copy.
- **For the practice:** meanings of symbols and colors, reflection questions on every tab, a "why did I choose this" note on every element, and a story of the crest on the second part of the PDF.
- **Privacy:** everything stays in the browser. No server, no analytics, no external requests. The crest is autosaved on the device; "Erase my data" wipes it all (important on a shared computer). A project can also be saved to a `.json` file and opened later.

## How it works

A crest is a document made of layers (`src/model/types.ts`). A single function, `renderCrest` (`src/render/renderCrest.ts`), turns it into SVG and is used by the editor and by every export, so a downloaded file matches the screen. The SVG contains only paths, solid fills and `clipPath`: no `<text>`, filters, masks or `<pattern>`, since those are what differ between browsers and PDF. Text is converted to outlines using the PT Serif and Cormorant fonts, so Cyrillic and Latin letters look the same everywhere. The price is that text in the PDF cannot be selected or searched.

```
src/shell/    shell: routing, tool registry, top bar, erase-all-data
src/model/    document, history, templates, data validation
src/render/   shields and divisions, patterns, ornaments, text, renderCrest, symbol fitting
src/export/   SVG, PNG, PDF and the story pages
src/ui/       Preact interface
src/data/     symbol catalog, colors, reflection questions (Russian)
src/i18n/     interface strings (ru.ts, en.ts) and English names and meanings (dataEn.ts)
scripts/build-symbols.ts   picks the icons from game-icons into src/data/symbols.json
```

Symbols are fitted to shield fields (`fitField` in `src/render/shields.ts`): the hand-tuned size and anchor of each field are checked against the actual shield outline and dividers, and a symbol that would stick out is shrunk and moved to the nearest place where it fits entirely.

## Editing the content

All content lives apart from the code. Russian is the source language; English sits next to it.

- `src/data/catalog.ts` — symbols with their names and meanings (an icon is given by its game-icons.net id; the build fails if there is no such icon);
- `src/data/tinctures.ts` — colors and their meanings;
- `src/data/prompts.ts` — reflection questions;
- `src/model/templates.ts` — templates (names, descriptions and captions are given in both languages);
- `src/i18n/ru.ts`, `src/i18n/en.ts` — interface strings; both files must have the same keys and `{placeholders}`;
- `src/i18n/dataEn.ts` — English names and meanings of symbols, colors, ornaments, shapes, divisions, patterns and questions;
- `src/ui/About.tsx` — the "About" page and a step-by-step guide for facilitators.

The meanings and questions are worded as possible associations and have not been clinically reviewed: look them over before working with groups. The tests check that every symbol, color, ornament and question has an English version.

### Adding a language

1. Add the code to `Lang` and `LANGS` in `src/i18n/index.ts` and a button label in `src/ui/LangSwitch.tsx`.
2. Create a dictionary with the keys of `src/i18n/ru.ts` and register it in `DICTS`.
3. Add translations of the data tables (`src/i18n/dataEn.ts` is the model to follow), the `Pair` fields of the templates and `About.tsx`.

## Running locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev        # http://localhost:5173/family-studio/
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end tests (Playwright); they build the site themselves
npm run build      # type check and build into dist/
```

End-to-end tests need the Playwright browser (`npx playwright install chromium`) and the `pdfinfo` and `pdftoppm` tools from poppler. WebKit tests are enabled with `E2E_WEBKIT=1` if its system libraries are installed.

### What the tests cover

- **Templates:** every template, in both languages, is checked geometrically (`tests/templates.test.ts`): nothing leaves the canvas, symbols stay inside the shield and their own field with a margin and do not touch each other, the shield, ornaments and captions are mirror-symmetric about the vertical axis, captions do not run into the shield, symbols or rings.
- **Shield fields:** for every shape and division, a symbol fits its field; mirrored fields are mirror images.
- **Translations:** both dictionaries have the same keys and placeholders, English text has no Cyrillic, and nothing in the catalog is untranslated.
- **End to end:** both paths from start to export, drag, rotate, scale, restoring after a reload, erasing data, no external requests, and switching the language. The shell has its own tests: address routing, tool switching, the erase-all helper and the storage check that reports a failed erase (Vitest), and the tabs, `?only=`, the page title and description, the Data menu, touch target sizes on phones, the erase-all dialog (confirmed, declined with the button or Escape, for both tools), its success and failure messages, and the erased crest not coming back (Playwright).
- **My Family:** the document model, the validated file and autosave format (damaged and hostile files), the SVG renderer, the exports, the store (autosave timing, a replaced drawing never coming back) and the download step (Vitest); in the browser (Playwright) adding, dragging within the sheet, an interrupted gesture, overlapping, properties, keyboard shortcuts, orientation, phones, save / open, PNG / SVG / PDF files (the PDF is checked with `pdfinfo` and `pdftoppm`), failures, and no external requests.

## Deployment

On every push to `main`, GitHub Actions checks types, runs the tests, builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repository settings: Settings → Pages → Source: **GitHub Actions**. The site address is set in `vite.config.ts` (`base: '/family-studio/'`).

## Licenses and credits

- Code: MIT (see `LICENSE`).
- **Icons:** [game-icons.net](https://game-icons.net), by Lorc, Delapouite, Skoll, Willdabeast, Lord Berandas and others, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The catalog icons are selected from the set; their color is changed in the editor. Credit is given on the "About" page, in the SVG metadata and on the first page of the PDF.
- **Fonts** PT Serif and Cormorant: SIL Open Font License 1.1 (via the `@fontsource` packages).
