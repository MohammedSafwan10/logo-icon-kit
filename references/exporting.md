# Deterministic exports

The exporter runs locally with Node 22+ and Sharp. Install dependencies in this skill folder with `npm ci`. Exporting does not use an API key or make image-generation calls.

```sh
node scripts/export-kit.mjs --config /path/to/brand.json --out /path/to/brand-kit
node scripts/verify-kit.mjs /path/to/brand-kit
```

Use a new output folder. A nonempty directory is rejected unless it contains this exporter's ownership marker. A rerun replaces its named outputs without recursively deleting the directory. If formats/configuration change, prefer a new folder so old extra files are not mistaken for current exports. Do not place output inside the skill's example sources.

## Inputs

```json
{
  "name": "Your Brand",
  "slug": "your-brand",
  "mark": "mark.svg",
  "wordmark": "wordmark.svg",
  "primaryTheme": "light",
  "themes": {
    "light": { "background": "#FAF5EB", "primary": "#5546B0", "secondary": "#EAAF3D", "text": "#242137" },
    "dark": { "background": "#242137", "primary": "#CEC5FF", "secondary": "#F4CA72", "text": "#FAF5EB" }
  },
  "platforms": ["web", "ios", "android", "sharing"],
  "iconScale": 0.72
}
```

SVG paths resolve relative to the config file. Paths and palettes belong to the caller; the example name, shape and colors are not defaults for other brands. Omit `wordmark` for a symbol-only export; do not describe that result as a completed wordmark/logo handoff.

The mark must have a positive `viewBox`, outlined vector geometry, and `{{primary}}` / optional `{{secondary}}` color tokens. The wordmark must be outlined SVG. Use explicit fill/stroke attributes, broad gaps, and a normalized viewBox; avoid CSS-based color rules and embedded images. Use true holes or gaps rather than background-colored patches that disappear in monochrome. The helper rejects scripts, external references, live text and embedded documents. It is not a general SVG sanitizer or an untrusted multi-user upload service.

## Wordmark helper

If needed, install fontTools in the chosen Python environment, then:

```sh
python scripts/outline-wordmark.py --font /path/to/licensed-font.ttf --text "Your Brand" --output /path/to/wordmark.svg
```

The helper maps simple left-to-right glyphs and optional tracking. It does not perform complex-script shaping, advanced OpenType layout, or professional optical kerning. Use an appropriate shaping/design tool for those cases. Keep the font and license out of a public kit unless redistribution is allowed.

## Output

The selected directory contains vectors and transparent PNGs, primary/alternate icons, requested platform folders, sharing artwork if requested, an HTML gallery, usage notes, and `manifest.json`. SVG wordmarks are outlined and portable; no dependency on fonts installed on the recipient's computer.

The gallery previews rounded icon masks, but opaque store masters remain full squares. An optional alternate icon is exported separately; the script does not register appearance switching. A web manifest is an example, not an enabled PWA. iOS and Android files are prepared assets, not native integration.

Serve the directory or open the gallery in a browser. Inspect 16/24/32px samples; the verifier checks dimensions and alpha, not visual legibility. For package sharing, ZIP only the selected brand-kit folder, excluding dependencies, private project files, and unrelated concepts.
