# Platform export notes

These are preparation defaults, not a permanent copy of platform specifications. Check current official guidance when integrating or submitting a native app. Match the project's actual target toolchain.

## Fixed identity versus appearance

An in-app light/dark toggle does not by itself change a device launcher. A useful policy is one fixed primary app/favicon/store identity, plus theme-adaptive logos inside the product. Export a dark alternate when useful, but do not silently enable it. Follow explicit user requests for OS appearance or alternate-icon integration.

## iOS

- Keep the primary 1024px store master an opaque full square, without baked corner rounding.
- The exporter provides a conventional iPhone/iPad AppIcon catalog and source layers for later Icon Composer work.
- Newer Apple icon workflows may need additional layered/appearance configuration in Icon Composer. Source PNGs are not a compiled `.icon` file.
- Import into the actual Xcode project and inspect system masks, effects and appearances on devices. Do not claim native installation based on an asset folder.

Official sources: [App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons), [asset catalog configuration](https://developer.apple.com/documentation/xcode/configuring-your-app-icon).

## Android

- Separate foreground and background on a 108dp adaptive canvas; reserve the central 66dp safe circle for essential artwork.
- Provide a monochrome mask for compatible system-tinted icons. System tint is distinct from an in-app toggle.
- The exporter measures the rendered artwork's radial bounds and scales it toward a 31.5dp radius, leaving a margin within the 33dp safe circle. Portable SVGs use the same placement as the density-specific PNG layers used by Android resources.
- Legacy density images and Google Play listing art are separate outputs. Store art is 512px and has no baked corner mask or exterior shadow.
- Import resources into the actual app, then inspect circle, squircle and other launcher masks. An example manifest fragment is not a complete Android manifest.

Official sources: [Adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Google Play icon specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications).

## Web and sharing

- Use a fixed SVG favicon plus 16/32/48px ICO/PNG fallbacks when that is the selected policy.
- Apple touch, regular web icons and maskable icons are distinct exports; keep maskable artwork within its safe region.
- A 1200×630 sharing card and square profile art are practical exports, not a promise that every service uses the same crop. Inspect the actual destination when integrating.
- Set site metadata only when integrating with the project's framework conventions. Do not enable a PWA, publish a site, or replace another brand's files as a side effect of export.

Official source: [MDN app icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons).
