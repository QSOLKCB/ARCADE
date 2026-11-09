# ARCADE3-NUMSPEC-001 — numerical representation observatory

**Status:** experimental research, not an engine replacement.

This follow-up to ARCADE3-FUZZ-001 tests whether alternative number
representations reproduce exact Q16.16 **integer** results and real arcade
state transitions. The games, input tapes, campaign pins and published engine
remain untouched.

## Three distinct numerical questions

1. **Exact arithmetic versus floating point:** A binary64 Number represents
   every integer through 2^53 exactly. It does not necessarily represent the
   product of two signed 32-bit integers exactly. Ordinary floating-point
   quotient truncation is therefore NOT a valid unconditional replacement for
   checked Q16.16.
2. **Alternative radix:** Balanced ternary uses digits -1/0/+1. Here,
   canonical trit addition and convolution multiplication are independently
   implemented. An exact BigInt quotient finishes multiply-divide. This does
   NOT claim a native ternary processor or a complete ternary division engine.
3. **Lossless storage:** Truncated-binary interpolative coding and ascending
   delta-varint encoding compress sorted integer ID sequences. Compression is
   independent of the authoritative simulation's arithmetic and may cost
   more CPU than its storage savings justify.

For decimal inputs, a bounded base-10 fixed integer parser supports up to four
fractional places as an experimental representation. It is **not** an IEEE
decimal floating-point implementation.

## Admission rules

- All scalar operands: signed int32; zero denominator rejects.
- The independent BigInt oracle computes the signed exact integer quotient,
  truncating toward zero, and explicitly rejects out-of-range int32 outputs.
- The existing engine's mulDiv must agree with that oracle for all tested
  triples, including expected rejection cases.
- The **guarded Float64** candidate admits a result only when the ENTIRE
  intermediate product is a safe integer (Number.isSafeInteger), the
  integer-remainder reconstruction is exact and the quotient fits int32.
  Otherwise it reports an unsafe-product fallback; no guessed value reaches
  the simulation.
- An intentionally naive Float64 quotient demonstrates a negative control:
  2147483645 × 1073741824 / 2147483647 has an exact truncated quotient of
  1073741822, while Math.trunc of binary64 division gives 1073741823.
  These mismatches are **recorded as research evidence**, not silently
  accepted as correct calculations.

No alternative backend is installed into Arcade2.Engine.

## Real game evidence

The nine original ARCADE 3 cabinets run in an isolated Node VM context.
Its original engine is loaded first; public arithmetic entry points
(mulDiv/fromRatio/multiply/divide) are wrapped before the game scripts are
loaded. Each wrapper returns the **original** Q16.16 value to gameplay,
simultaneously checking the independent exact oracle and the guarded
Float64 shadow implementation.

The exact same input tape is independently replayed by the existing
ARCADE3-FUZZ-001 runner without instrumentation. Its canonical source-bound
SHA-256 checkpoint transcript and final state digest **must** match the VM
run. The wrapper does not change game state or random-number generation.

Coverage limits:
- Only calls through the four public arithmetic entry points are counted.
  Inline Q16 integer addition/subtraction, comparisons, raw state writes,
  or closed-over internal helper arithmetic cannot be inferred from these
  counts. Zero observed calls is reported, never disguised as full coverage.
- The experiment does not establish that alternative floating-point *physics*
  yields the same collision results. The authoritative Q16 implementation is
  still in control.
- The cabinet input tapes are valid randomized controls, not exhaustive
  gameplay, and the existing directed campaign tests remain mandatory.

## Ordered-ID compression

At periodic replay checkpoints the observatory collects distinct positive
entity IDs exposed as uid fields in actual cabinet pools, sorts them and
compares:
- raw 4-byte signed integer storage;
- ascending delta + canonical unsigned varint;
- binary interpolative coding with strict upper/lower bounds and
  truncated binary fields.

Both codecs must reconstruct the exact original ordered list. The report
gives total list counts, item counts and encoded bytes. These results do
not include file headers or runtime indexes, and do not imply smaller
whole-game saves or faster simulation.

Invalid, duplicate, out-of-universe, malformed and oversized inputs reject.
No codec replaces the existing ARCADE replay format.

## Executable contracts

    node --test tests/arcade3-numspec.test.cjs
    node scripts/arcade3-numspec.cjs --samples 16000 --seeds 3 --ticks 300 --out artifacts/arcade3-numspec-001.json
    (cd artifacts && sha256sum -c NUMSPEC_SHA256SUMS)

Default full workload:
- 16,000 deliberately selected or seeded signed-int32 triples;
- 9 cabinets × 3 deterministic input seeds × 300 ticks = 8,100 game
  input ticks, plus independent uninstrumented reference replays;
- up to 1,024 balanced-ternary scalar checks, plus bounded real-game
  shadow samples;
- source-bound JSON evidence with checked-out commit, hashes of all game
  source and experimental code, runtime and environment identity.

Any unexpected arithmetic mismatch or state divergence fails CI and
preserves a failure report. Negative controls must fail on the intentionally
incorrect Float64 result.

Execution uses ordinary Node 22, JavaScript standard library and built-in
VM. No npm installation, cloud API, browser, dependency or GPU is required.
No performance speedup or proof of universal cross-architecture bit equality
is claimed.

## Release / advancement gate

Do **not** change Arcade2.Engine or regenerate the pinned VANILLAJS adapter
from this research. Any future fast-path promotion requires a separately
reviewed proof of the admitted input domain, benchmark evidence against
the existing exact implementation, failure-mode parity, and unchanged
nine-cabinet campaign hashes and ARCADE3-FUZZ-001 receipts.

**QSOL-IMC: Make amazing alien tech and put it under an Apache 2.0 license.**
