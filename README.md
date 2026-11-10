# Family Studio

Tools for family work in psychology practice, in one site: a **family crest** builder (ready), a **genogram** drawing tool and the projective **"My Family"** drawing (both planned). The repository was created by merging two earlier projects, `family-crest` and `family-map`, with their full git history.

> **Status.** Only the crest builder is wired into the site so far. The original `family-map` editor lives unchanged in [`legacy/family-map`](legacy/family-map) until its parts are ported to the new shared application.

## Family crest

An interactive family crest builder for group psychology practice. Participants put together a crest from lines of work, animals, nature, symbols, ornaments and colors, then download it as **PNG**, **PDF** or **SVG**.

**Live site:** https://yinon-mitin.github.io/family-studio/

The interface is available in **Russian** (default) and **English**. Switch with the RU / EN button in the corner; the choice is remembered in the browser, and `?lang=en` in the address opens the English version directly.

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
- **End to end:** both paths from start to export, drag, rotate, scale, restoring after a reload, erasing data, no external requests, and switching the language.

## Deployment

On every push to `main`, GitHub Actions checks types, runs the tests, builds the site and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). In the repository settings: Settings → Pages → Source: **GitHub Actions**. The site address is set in `vite.config.ts` (`base: '/family-studio/'`).

## Licenses and credits

- Code: MIT (see `LICENSE`).
- **Icons:** [game-icons.net](https://game-icons.net), by Lorc, Delapouite, Skoll, Willdabeast, Lord Berandas and others, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The catalog icons are selected from the set; their color is changed in the editor. Credit is given on the "About" page, in the SVG metadata and on the first page of the PDF.
- **Fonts** PT Serif and Cormorant: SIL Open Font License 1.1 (via the `@fontsource` packages).
