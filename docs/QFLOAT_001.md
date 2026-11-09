# QFLOAT-001 — The Floating Illusion

**QSOL-IMC: Make amazing alien tech and put it under an Apache 2.0 license.**

## Engineering rationale

The DOOM-era trick was not that IEEE floating point secretly powered
everything: DOOM itself used 16.16 fixed-point arithmetic for much of its
simulation and geometry. QFLOAT-001 applies the same practical separation:
give authors a decimal-like interface while keeping **checked signed Q16.16
integers** as the only authoritative state and arithmetic.

This is a first-party **authoring façade**, not a new numerical backend and
not an attempt to rewrite/replace the existing VANILLAJS integer engine.

## Implementation

- Load the exact pinned arcade2/engine.js before arcade2/qfloat.js.
- A.QFloat.fromDecimal takes a canonical *string* such as "1.25".
  Decimal characters are interpreted as an exact BigInt rational, converted
  to raw Q16.16 subunits and explicitly **truncated toward zero**.
- No binary floating-point conversion is used during input parsing.
- The immutable Scalar exposes raw int32, exact decimal output and rounded
  presentation-only values; add/subtract/multiply/divide/sqrt delegate
  to the original checked integer engine.
- Scalar.valueOf and numeric Symbol.toPrimitive reject implicit arithmetic
  through JavaScript Number. Call Scalar.add(other), etc. explicitly.
- Serialization writes only tagged integer data; strict decoding refuses
  unknown fields. The optional Point is an integer-owned vector façade.
- The quantization step is exactly 1/65536. A finite decimal such as 0.1
  cannot be represented exactly in Q16.16; its raw value is 6553.
- A.QFloatSim stores ONLY signed 32-bit integer x/y/speed values and a
  bounded whole-number tick. Its visible decimal coordinates are derived
  at the Canvas/UI boundary.
- The lab uses one 60Hz integer-authoritative simulation step and a
  bounded requestAnimationFrame catch-up loop. Render time is not game time.
  Blur/visibility loss pauses movement.

## Run locally / offline

Open arcade3/qfloat-lab.html from an extracted local checkout or visit:

    https://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.html

The link becomes live after a reviewed merge and Pages deployment. It
requires no npm install, network access, CDN, account or third-party JS.
The existing service worker includes the lab files under its new revision.

The live lab displays:
- Rounded, float-looking XYZ coordinates (actually X/Y 2D coordinates).
- Exact 16-decimal-place values of the quantized Q16 integers.
- The signed Q16.16 underlying integer words.
- An FNV-1a *visual state token*. This is explicitly NOT a cryptographic
  proof or release receipt.
- A configurable exact-decimal author input for velocity per game tick.
- A decimal A + B experiment, initially 0.1 + 0.2.

For the initial decimal experiment:

    0.1   -> raw  6553 -> exact 0.0999908447265625
    0.2   -> raw 13107 -> exact 0.1999969482421875
    sum   -> raw 19660 -> exact 0.2999877929687500
    UI display at three digits -> "0.300"

The display is intentionally pretty; the raw values are authoritative.

## Exact API example

    const F = Arcade2.QFloat;
    const x = F.fromDecimal('1.25');
    const dx = F.fromDecimal('0.5');
    const next = x.add(dx);

    next.raw;        // 114688, a signed Q16.16 integer
    next.number;     // 1.75, presentation-only Number
    next.approx(3);  // "1.750", presentation-only string
    next.exact();    // "1.7500000000000000", exact decimal

    // A fatal exception deliberately prevents a silent double-path bypass:
    // x + dx;  // TypeError: implicit coercion prohibited

The existing optimized signed limb + safe-integer Q16 kernel remains in
charge of all operations. Do not create one Scalar allocation per inner-loop
math operation in performance-sensitive production code. Use the original
raw-int functions directly there, and this API for readable authoring and
inspection at slower boundaries.

## Test and preservation gate

    node --test tests/qfloat-illusion.test.cjs
    node --test tests/arcade3.test.cjs
    node --test tests/*.test.cjs
    node scripts/check.cjs

Unit tests cover exact decimal parse and quantization, 16-place exact
output, error parity, range handling, overflow, implicit-float rejection,
value serialization and a 500-tick cross-run replay equality check.
The existing test suite retains all nine ARCADE 3 campaign hashes.

No exported Q16 method, generated arcade2/engine.js file, existing
gameplay source or campaign hash is modified by QFLOAT-001.

## What this does NOT prove

- It does not make the 60Hz simulation faster; immutable object allocation
  is an authoring convenience and can be slower than raw integer math.
- It does not turn 0.1 into an exact Q16.16 value; quantization is stated.
- It is not IEEE 754 decimal floating point, arbitrary precision decimal
  arithmetic, interval arithmetic or a replacement for floating-point GPUs.
- The Canvas2D renderer uses JavaScript Numbers for pixel presentation;
  only authoritative world state remains integer-backed.
- It is not a new game cabinet and does not alter any historical replay pin.
