# NUMSPEC-PERF-002 — observed hosted-CPU result

**Decision: do not promote the candidate.** The already-optimized, exact
ARCADE/VANILLAJS Q16.16 implementation was faster in every measured domain.

## Source-bound execution receipt

- Run: GitHub Actions 42597216942 (first successful candidate profile).
- Node.js: v22.23.4; Linux x64; ubuntu-24.04 hosted workflow.
- PR test merge source HEAD: 44c5bfc3b76907373ccbadd17e9470738986e548.
- Retained evidence artifact:
  arcade3-numspec-perf-002-42597216942-1.zip.
- Canonical JSON SHA-256:
  d428a5a120e606e496b1be68fa3d4a739169f620aae1c01edeccd95a561e6721.
- The retained NUMSPEC_PERF_SHA256SUMS successfully verified.
- Existing ARCADE test workflow 42597216990 succeeded.
- Existing numerical observatory workflow 42597216928 succeeded.
- Reference and candidate each completed all nine campaigns (29 stages),
  preserving all nine frozen SHA-256 pins and exact observed win conditions.
- Candidate arithmetic instrumentation recorded 4,736,785 public calls
  across the winning campaigns: 4,736,785 safe products, 0 fallback products.

## Paired CPU measurements

The following medians include JavaScript call and harness overhead,
not entire game frame or GPU timing. Nine paired AB/BA trials and two
warmup pairs per dataset.

| Data | Samples | Reference median ns/call | Candidate median ns/call | Ratio of medians |
| --- | ---: | ---: | ---: | ---: |
| Actual campaign-derived operands | 3,875 | 41.43 | 60.76 | 0.682 |
| Synthetic safe products | 2,048 | 51.38 | 57.82 | 0.889 |
| Synthetic wide, exact fallback | 2,048 | 78.18 | 102.26 | 0.764 |

A ratio below 1 means the candidate is slower. The independent
median-of-paired-ratios results were 0.660, 0.891 and 0.770 respectively.
The existing engine is faster in all three measured input domains.

These are single-host, same-process microbenchmarks. They do not support
universal machine-wide speedup estimates, independent-process inference,
or claims about other JavaScript engines or gaming FPS.

## Why this is a useful result

The existing exact Q16.16 implementation already uses a safe-integer
Number multiplication fast path. Introducing a wrapper that independently
checks and dispatches that path adds expense while offering no new
numeric admission domain. The result validates preserving the existing
optimized implementation rather than replacing it.

The entire experiment intentionally leaves the production engine, all
game rules and every campaign hash unchanged. The report states
promotionStatus=NOT_ADMITTED.

Future performance work should profile **real call sites and state
generation costs**, e.g. repeated immutable conversions, unnecessary
world scans or allocations, while retaining exact Q16 replay contracts.
Any further candidate requires separate review and multi-host evidence.

**QSOL-IMC — Make amazing alien tech and put it under an Apache 2.0 license.**
