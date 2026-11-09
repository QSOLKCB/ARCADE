# QFLOAT-RUNNER-001 — owner-run headed browser acceptance

**Goal:** validate the real QFloat Lab on the owner's RTX 5060 Ti desktop after
PR #16 is reviewed, merged into main and deployed to GitHub Pages.

Workflow: .github/workflows/qfloat-lab-runner.yml

## Run procedure

1. Merge QFLOAT-001 PR #16 and confirm the main-branch **Publish arcade**
   workflow deployed the lab:
   https://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.html
2. From your logged-in **graphical desktop**, start the existing runner
   with ./run.sh. Do not run headless, via SSH or as a displayless service.
3. GitHub → Actions → **QFLOAT-001 — owner desktop browser validation**
   → Run workflow. Select the main branch.
4. Tick **acknowledge_local_execution**. Leave **verify_pages** enabled
   to test both the reviewed local checkout and its published Pages copy.
   Tick **publish_evidence** only if you want a private local report copied
   to a GitHub artifact retained for 14 days.
5. Inspect the Actions summary and locally retained sealed evidence at:
   $HOME/.local/state/qsol/arcade/qfloat/qfloat-RUN_ID-ATTEMPT

If GitHub Pages has not finished deploying the merged commit, the job
rejects its content hash and explains the mismatch. Rerun after Pages
finishes. Setting verify_pages=false tests only the local checkout.

## Safeguards

The workflow is **workflow_dispatch only**. It cannot be triggered by
push, pull request or schedule on a personal computer. It requires the
repository owner EmergentMonk, explicit checkbox approval, main branch,
exact clean HEAD and correct origin, and a graphical desktop session.
The runner label is self-hosted/linux/x64/qsol-rtx5060ti.

Node uses the existing runner-owned Playwright v1.64.0 and locally
installed native Chrome/Chromium. No package installation, Docker, CDN
script, test harness download or new game runtime dependency is added.

The local server listens on 127.0.0.1 and serves only the six QFloat
runtime dependencies. The published-site preflight downloads only those
six assets by canonical HTTPS URLs, disallows redirects, and checks each
asset SHA-256 against the reviewed Git checkout. The browser then runs
that exact already-verified byte snapshot under the Pages origin, never
unverified later network bytes. Service workers are blocked to avoid
stale cache interference.

## Real-browser acceptance conditions

- Actual headed Chromium opens the page without console/page errors.
- The Canvas2D center pixel is actually rendered, not a mocked drawing.
- 0.1 + 0.2 shows 0.300, while exact Q16.16 is
  0.2999877929687500 and the raw signed integer is 19660.
- Arrow-key movement advances X by exactly 81920 raw Q16.16 units
  for a single tick at speed 1.25.
- Releasing all controls produces no further movement.
- Multiple keyboard aliases preserve a held direction until all
  aliases are released.
- Real requestAnimationFrame advances whole simulation ticks.
- Pause and window blur freeze tick progression.
- Invalid speed 20.1 and malformed decimal text 1e3 reject safely.
- Reset restores the original raw integer coordinate.
- A 390-pixel mobile viewport does not overflow horizontally.
- Desktop and mobile screenshots are retained for both selected origins.

Successful execution produces a PASS JSON report, summary, screenshots
and SHA256SUMS. Failures preserve a FAIL report and diagnostic screenshot
when possible. Evidence includes exact source SHA, file hashes, Node,
runner, CPU, Playwright and browser versions.

This witnesses real browser operation and exact integer authority,
not GPU timing, a formal mathematical proof or performance speedup.
The ARCADE3 campaign/fuzz/NUMSPEC gates remain independent.

**QSOL-IMC — Make amazing alien tech and put it under an Apache 2.0 license.**
