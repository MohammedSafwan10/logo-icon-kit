---
name: logo-icon-kit
description: Design or refine a logo, then prepare a consistent brand asset kit with vector masters, app icons, favicons, platform layers, and sharing artwork. Use for logo exploration, selected-mark cleanup, or multi-format icon handoff; not for unrelated UI icons or full application development.
---

# Logo & Icon Kit

Take a brand from visual exploration to a reusable, verifiable asset folder. Match the requested stage: a few image concepts do not require a platform export run, and an approved mark does not need another round of concepts.

## Establish the brand and deliverable

Read relevant project guidance and inspect existing marks, typography, theme colors, and where the logo appears. Identify what is selected, what can change, the requested formats, and whether replacement is authorized. Preserve an approved silhouette and palette unless the user asks to change them.

Separate three decisions:

- **Symbol and wordmark:** the identity and its proportions.
- **In-product appearance:** how that identity reads on light/dark surfaces.
- **Launcher, favicon, store, and sharing identity:** the external recognition policy. A fixed primary icon is a useful default, but honor a request for OS appearance variants. Do not equate the app's theme toggle with the device launcher theme.

Infer routine choices from context. Ask only when a missing choice materially changes the work; do not ask again for an already selected mark. A new brand can explore colors; adapting an approved product should normally start with its current colors. Do not transplant the example brand or palette.

## Explore when needed

Use a small set of genuinely different concepts, or the number requested. Vary the silhouette and underlying idea, not only colors. Connect the idea to the actual product or place without forcing an initial, mascot, map pin, or literal industry illustration. Simplicity should still have a memorable outline.

When the user asks for image-generated concepts, use the available image-generation tool and its applicable instructions. Use one generation per distinct concept; show the results inline. Do not quietly substitute hand-coded graphics for requested generated artwork. If generation is unavailable, state that and continue with an agreed editable-vector approach rather than claiming images were generated.

For prompts and controlled recolors, read [references/concepts.md](references/concepts.md). Keep symbols, wordmarks, and optional slogans separate. Light/dark comparisons must use the same geometry. Include a symbol-only study rather than hiding weaknesses in a large presentation. Do not claim trademark uniqueness or 16px legibility from a large generated mockup.

Recommend based on the actual result: recognition, product fit, silhouette, reproducibility, and small-size behavior. Be candid about resemblance to familiar marks. If a choice is still open, let the user select before extensive downstream export work, unless they delegated that choice.

## Build one clean source

For an approved simple mark, use editable SVG geometry. Generated artwork is a reference; exporting resized screenshots is not a vector master. Inspect the reference, reconstruct faithfully, and show the cleaned mark at useful sizes. Record meaningful differences rather than describing a manual reconstruction as pixel-identical.

Keep color roles explicit. Prepare light/dark and black/white versions only where requested or useful. A silhouette should remain understandable without relying on gradients, effects, or a colored presentation background. These are design criteria, not a ban on brand treatments the user requested.

Outline export wordmarks using a legitimately available font or supplied vector source. Preserve the source font/license when distribution allows it. Keep interface text native. The optional `scripts/outline-wordmark.py` helper handles simple left-to-right labels; use an appropriate shaping tool for complex scripts, ligatures, or professionally kerned artwork.

## Export the requested kit

For repeatable platform output, read [references/exporting.md](references/exporting.md). The bundled Node exporter accepts the project's own normalized SVG mark, optional outlined wordmark, and palette configuration. It writes only an owned output directory; it does not modify a website, initialize a native app, publish a repository, or install launchers.

Typical deliverables, scaled to the request:

- Source SVG, transparent mark/lockup PNGs, outlined wordmark, single-color assets.
- A fixed primary icon and optional alternate appearance exports.
- Favicon SVG/ICO/PNGs, Apple touch icon, web/maskable assets.
- Opaque iOS assets, Android adaptive foreground/background and monochrome layers, store images.
- Sharing cards, avatar, compact gallery, usage notes, and an optional brand-only ZIP.

Read [references/platforms.md](references/platforms.md) only for requested platform exports. Verify current official requirements when native integration or store submission depends on them. Do not bake an OS mask or shadow into store masters. Keep safe-area and monochrome masks separate from decorative previews.

If product replacement is authorized, check callers before changing the shared mark, metadata icons, and theme colors. Reuse one geometry source where practical. Check for obsolete public comparisons and stale favicon files. Archive or remove old assets only within the user's cleanup scope; never clean unrelated projects or image-generation history.

## Inspect and hand off

Run the exporter and `scripts/verify-kit.mjs` when using the bundled scripts. Inspect the actual gallery, primary icon, transparent/monochrome variants, wordmark margins, and small icons. Check relevant masks and light/dark surfaces. File dimensions alone do not establish a good logo or native device correctness.

For integrations, inspect the running product and exercise theme switching. Verify that the external icon remains fixed if that is the chosen policy, and that shared SVGs inherit the intended in-product colors. Use existing appropriate checks rather than adding a broad test framework for a reversible asset change.

Keep one selected folder with a source/provenance note, font/license information where applicable, a file manifest, theme policy, and platform integration limits. Preserve the selected generated reference where available. The exporter’s manifest covers files it generated; add selected references and prompts alongside it as appropriate.

Deliver viewable previews, actual saved paths, and a download archive when requested. Distinguish generated concepts, cleaned vectors, exported resources, and installed native icons. Public repository creation or other external publication needs user authorization; generating the kit does not imply it.
