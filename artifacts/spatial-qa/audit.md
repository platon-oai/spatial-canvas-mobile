# Spatial canvas interaction QA

Date: 2026-07-01

## Tested steps

1. **Fullscreen desktop board — healthy.** The app root and canvas both measured 1440 × 900, and no artificial window, title bar, or fake traffic-light nodes remained. Evidence: [01-desktop-fullscreen.jpg](./01-desktop-fullscreen.jpg).
2. **Two-finger trackpad pan — healthy.** A browser wheel gesture changed the retained world transform immediately and produced one live camera frame followed by one canonical camera commit. The camera position persisted after the debounced commit.
3. **Pinch and zoom model — healthy.** Cursor-centered wheel zoom and the two-touch centroid model share the same retained camera renderer. Automated tests cover zoom anchoring, simultaneous two-finger translation, extreme zoom clamping, and the Safari gesture-event fallback. `+`, `-`, and `0` provide keyboard-accessible zoom equivalents.
4. **Direct item manipulation — healthy.** A multi-point drag produced two live visual frames and one item-state commit; React rendered only at interaction start and end.
5. **Phone viewport — healthy.** At 390 × 844, the root and canvas exactly matched the viewport, the document had no overflow, off-screen culling mounted 7 of 12 cards, and every visible primary control measured at least 44px. Evidence: [02-mobile-final.jpg](./02-mobile-final.jpg).

## Issues found and fixed

- React Strict Mode replay destroyed the long-lived interaction controller during startup. The controller cleanup is now deferred and ownership-checked, so wheel and pinch input no longer targets a dead instance.
- Mobile was forced to a 920 × 620 minimum layout. Those constraints are removed and the board now uses the dynamic viewport with safe-area offsets.
- There was no native two-touch camera gesture. Two pointers now pan and pinch simultaneously around their live centroid, and one-finger background drag pans on touch devices.
- The faux window frame consumed space and duplicated OS chrome. It was removed completely.
- Autosave status caused invisible React rerenders. That UI state and an unnecessary board-list refresh were removed from the hot path.
- Item lookup was rebuilt on every React render, culling used a large overscan area, and images decoded synchronously. Lookup is memoized, overscan is tighter, and image loading/decoding is deferred.
- The production JavaScript shipped as one large parse block. It is now split into cacheable app, React, Motion, storage, and icon chunks.
- Mobile primary controls were shorter than the recommended touch target and an invisible edge toggle intercepted touches. Controls are now 44px tall and the edge toggle is disabled on coarse pointers.

## Accessibility and evidence limits

- Keyboard focus outlines remain visible, and keyboard zoom is available without a gesture.
- Browser-level page zoom is disabled so mobile pinch controls the spatial camera, matching a design-canvas interaction model. Text remains zoomable through the canvas controls.
- The controlled browser can emit wheel, pointer, drag, and keyboard input but cannot synthesize physical multi-touch hardware. The real touch path is covered by deterministic camera tests; final confirmation on an actual phone remains the last hardware-specific check.
- Still screenshots verify layout and visible controls, but they cannot prove animation timing on their own; live-frame and commit counters were used for that behavior.
