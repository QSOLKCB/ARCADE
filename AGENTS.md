# ARCADE contributor rules

Read this file, docs/INVARIANTS.md and docs/ARCHITECTURE.md before changing code.

- Preserve original authorship: no ROMs, ripped sprites, copied maps, soundtrack samples or third-party game source.
- Keep the runtime buildless, dependency-free and playable by opening index.html from an extracted checkout. All runtime URLs are relative.
- Preserve Apache-2.0 and document historical inspirations without implying endorsement or an exact port.
- Keep simulation at a fixed timestep. Pause on visibility/focus loss. Clear input on scene changes.
- Never add telemetry, accounts, network gameplay or external runtime requests without explicit maintainer direction.
- Keep all nine games completable. Test campaign transitions, failure/restart, objective reachability and offline caching after relevant changes.
- Run npm test and npm run check. For browser QA, use the available browser environment; record precisely what was actually verified.
- Keep the existing Pages publishing workflow minimal. It verifies and deploys static files; do not add unrelated CI or scheduled workflows without maintainer direction.
- js/vanilla2d.js is generated: change VANILLAJS upstream and rerun `node scripts/vanilla2d.cjs /path/to/VANILLAJS`, never edit it by hand.
- Bump the release cache key in sw.js whenever changing a runtime resource. Keep its precache list complete.

- ARCADE3-NUMSPEC-PERF-002 is a research-only promotion gate. Keep the generated arcade2/engine.js, game source and replay pins unchanged. Never substitute a candidate without independent exactness evidence, nine-cabinet full-campaign parity and owner-approved production PR.

- QFLOAT-RUNNER-001 runs only by explicit owner workflow_dispatch on clean reviewed main, never from PR/push/schedule. Keep the Playwright tooling preinstalled and outside the checkout, pin published HTML/CSS/JS bytes to main before executing on the owner workstation, and preserve sealed screenshots and FAIL records without claiming a browser execution before it runs.
