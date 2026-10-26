# Changelog

## Unreleased — standalone page-only gesture update

- Remove the bundled BetterTouchTool Glance-state bridge.
- Remove BTT URL-handler and macOS subprocess dependencies.
- Require an actual selected-browser hit test, not only bounding-box overlap.
- Leave rejected Spaces/sidebar/toolbar/overlay gestures to Zen.
- Bind native closing swipes to a verified start and the same tab/browser.
- Require native completion within two seconds and recheck the page.
- Bind wheel bursts to their starting tab/browser and initial history state.
- Fail safely when navigation state is unknown.
- Preserve default pinned-tab protection and native history navigation.
- Add installation screenshot, full documentation, and mocked regression tests.

Initial local feedback was positive. Full cross-platform and crash-regression testing remains outstanding.
