# DAM OPERATIONS — Cross-platform in-page installation popup

## Apply to your repository
This is an **incremental update to the previously supplied DAM_OPERATIONS_PWA_PATCH_NO_NEW_D1.zip**. Apply the earlier PWA patch first, then overlay these 3 files at the repository root, preserving their paths. Do not replace the entire repo with this small ZIP.

- `src/main.jsx` — mounts the install invitation alongside the existing app and PWA status.
- `src/pwa/InstallAppPrompt.jsx` — install prompt and browser-specific instructions.
- `src/pwa/InstallAppPrompt.css` — top-right animated glass-style popup, mobile responsive.

## Platform behavior
- Chromium browsers on Android, Windows, macOS: if the browser exposes `beforeinstallprompt`, Install App opens its native dialog. Otherwise the button shows browser installation steps.
- Safari on macOS Sonoma or later: shows File > Add to Dock instructions (Safari does not provide a programmable native install prompt).
- Safari on iOS/iPadOS: shows Share > Add to Home Screen instructions.
- Installed/standalone app: no popup.
- Not now or close: dismiss for 7 days using browser-local storage. Browser storage can be cleared by the user.
- Popup appears after ~1.8 seconds when eligible; it never force-installs an app.

## Prerequisites
Keep the PWA manifest, service worker, icons, and HTTPS from the earlier patch. For browser installation, deploy over HTTPS and ensure your manifest and service worker are reachable.

## Strict data boundaries
This incremental update is **frontend-only** and does not add or access Cloudflare D1, KV, R2, Supabase, or Firebase. It does not remove any pre-existing backend D1 dependencies from the original repository. The previous patch's offline limitations still apply.

## Test
Run `npm run build`. Test on Safari macOS, Safari iOS, Chrome Android, and Chrome/Edge desktop. For native prompt testing on Chromium, the browser controls eligibility and prompt availability. Test dismiss and installed display modes.
