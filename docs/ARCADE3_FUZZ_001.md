# ARCADE3-FUZZ-001 — randomized input and failure receipts

**Scope:** the nine original ARCADE 3 cabinets merged through PR #11.
This is an independent test harness; it changes no cabinet rules, frozen
campaign pins, rendering paths or deployed asset bundles.

## The falsifiable questions

1. Can *valid* but previously untested control sequences crash a game?
2. Does a checked Q16.16 error arise during *legal* play? Invalid direct
   arithmetic is expected to throw and is not a game defect.
3. Given identical cabinet, seed, controls and program source, is the entire
   sampled state receipt identical across independently constructed runs,
   with and without rendering?
4. Does drawing change authoritative state, or do resource pools become
   unbounded?
5. Are wins/losses, stage advances and terminal freezes obeyed under random
   controls and deterministic restarts?

## Input generator and deterministic coverage

The 32 default seed indices are 1 through 32. Each is mixed with the cabinet
identifier into a defined 32-bit PRNG state. No ambient Math.random, clock or
network state is used.

Every seed generates 2,000 input frames with:
- X and Y constrained to -1, 0, +1, like the real sampler.
- A/B/C/D buttons that hold state between frames and toggle occasionally.
- Pressed edges exactly when a button changes from up to down.
- AReleased exactly when A changes from down to up.
- An optional bounded pointer-aim coordinate only when directional keys are
  neutral; an actual directional press clears pointer aim.
- Identical input tape on both independent simulation instances.

The harness samples complete serialized state every 31 ticks and at the final
frame, runs deep finite-value and pool-bound checks, and draws every 127 frames
during the first pass. The second pass uses no drawing. Both must produce the
same SHA-256 transcript and final-state checksum.

On win/loss, the harness verifies that a further tick leaves terminal state
unchanged, then creates a fresh cabinet instance for continued coverage. On
stageclear it advances via next() and records that transition in the digest.

The regular native Node smoke tests include every cabinet, input validity,
adversarial invalid-edge refusals, expected Q16.16 guard failures, and
deterministic render/no-render replay comparisons.

## Execute and reproduce

No npm installation is needed to execute the existing project tests:

    node --test tests/arcade3-fuzz.test.cjs

The full workload (9 cabinets × 32 seeds × 2,000 ticks) is:

    node scripts/arcade3-fuzz.cjs --seeds 32 --ticks 2000 --out artifacts/arcade3-fuzz-001.json
    (cd artifacts && sha256sum -c SHA256SUMS)

A source-checked workflow automatically runs it on the affected PRs and on
main pushes, retaining the JSON and SHA256SUMS artifact even on a failed run.

If a failure occurs, the report records the cabinet, numeric seed, tick,
last successful state digest, exact exception type, message, stack and the
verbatim input prefix leading to failure. An optional bounded chunk minimizer
tries to produce a shorter tape, **without deleting the original witness**.
Every shrink candidate has its pressed/released edges recalculated so that
it remains a physically realizable sequence.

To reproduce the original failure locally, using a downloaded retained
artifact:

    node scripts/arcade3-fuzz.cjs --replay artifacts/arcade3-fuzz-001.json

No failed run is claimed to have passed. No CI override, silent overflow
recovery, automatic campaign repinning or forced merge is performed.

## Measurement and claim boundaries

- 576,000 input frames plus a second render-free replay are performed by the
  full configuration. This is not equivalent to exercising all possible
  inputs, user interaction pathways or numeric boundary values.
- Deep state auditing is periodic, not an exhaustive proof that every
  intermediate is integer-valued. Q16.16 authoritative operations already
  guard admissible values; a deliberate exception for invalid *direct*
  arithmetic is success, not a fuzz defect.
- Field-level float values may legitimately occur in presentation-only
  state; the harness refuses nonfinite values but does not blindly require
  every numeric field to be an integer.
- This is randomized **valid-control** fuzzing, not byte fuzzing of arbitrary
  JavaScript objects or a formal verified floating-point refinement.
- It is CPU/Node runtime evidence, not native GPU, RTX or human playability
  evidence. Manual controls and device/browser quirks need their own audit.
- The repository's existing 29-stage completion pins remain unchanged;
  those tests provide complementary directed campaign coverage.

**QSOL-IMC — Make amazing alien tech and put it under an Apache 2.0 license.**
