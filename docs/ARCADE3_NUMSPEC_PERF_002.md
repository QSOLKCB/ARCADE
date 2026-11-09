# ARCADE3-NUMSPEC-PERF-002 — bounded Float64 performance promotion gate

**Status: experimental candidate; NOT promoted to production.**

Builds on the merged NUMSPEC-001 observatory (PR #14). It measures an
alternative checked mulDiv fast path with the exact original engine as
fallback. No authoritative ARCADE2/VANILLAJS source, original game logic,
frozen replay pin, packaged browser resource or release tag is changed.

## Important context

The existing Q16.16 arithmetic ALREADY contains a Number/Float64 safe
integer fast path, and exact radix-65536 widened division fallback.
This candidate rearranges that fast path to check the signed product
directly, before general sign/magnitude computation. We are testing a
micro-optimization, NOT introducing a brand-new floating-point engine.

The candidate validates every signed-int32 operand. It rejects zero
denominators and final int32 overflow. An admitted signed product must
satisfy Number.isSafeInteger(a*b). If admitted, it first removes the
integer remainder, then divides: (p - p % d) / d, with truncation toward
zero. If unsafe, the exact original implementation is called unchanged.

Every selected scalar sample must match both the original implementation
and a separate BigInt multiplication/division oracle before it can be
used for performance measurements. The known negative control
2147483645*1073741824/2147483647 must yield 1073741822, never the naive
rounded Float64 result 1073741823.

## Complete campaign gate

For each of nine ARCADE 3 cabinets, create two separate Node VM worlds:
the original engine, and the candidate arithmetic installed before all
game scripts are loaded. Run the same real control-only test policy
from tests/arcade3-policy.cjs.

Each VM must independently win every stage, match the exact unchanged
pin from tests/arcade3.test.cjs, and agree with the other VM on the
full campaign result. Across the nine cabinets, there are 29 stages.

The standalone test file remains an independent source of pinned
campaign checks. The CI workflow additionally executes it unchanged.
The new research script cannot repin any campaign automatically.

Only public Q16 arithmetic calls are counted. Closed-over internal
arithmetic, inline game calculations and unvisited states cannot be
inferred from the counters.

## Paired CPU microbenchmarks

Three datasets:
- sampledGame: bounded triples captured from actual winning campaigns.
- syntheticSafe: typical signed operands with safe intermediate products.
- syntheticWide: large operands requiring the exact widened fallback.

Run two warmup pairs and nine measured alternating AB/BA pairs by default,
with eight passes over the input dataset per timed trial. The runner records
raw nanoseconds, sample count, checksums, median ns/call, and median of
paired reference-to-candidate speedup ratios. All measured inputs have
already passed an independent exactness check.

These numbers include JavaScript call and harness overhead on one hosted
Node/CPU process. They are not full-game frame times, independent-process
benchmark replications or statistically validated across processors.
Do not advertise a speedup if results are inconclusive or slower.

The gate ALWAYS reports promotionStatus=NOT_ADMITTED. A separate later PR
would require two independent hardware environments, repeated runs,
int32 failure parity, original campaign pins, and the existing fuzz tests.

## Reproduce

    node --test tests/arcade3-numspec-perf.test.cjs
    node --test tests/arcade3.test.cjs
    node scripts/arcade3-numspec-perf.cjs --rounds 9 --iterations 8 --out artifacts/arcade3-numspec-perf-002.json
    (cd artifacts && sha256sum -c NUMSPEC_PERF_SHA256SUMS)

CI retains JSON PASS/FAIL evidence and SHA-256 manifests. The report
identifies the actual checkout SHA and each used source/test-policy file.

**QSOL-IMC — Make amazing alien tech and put it under an Apache 2.0 license.**
