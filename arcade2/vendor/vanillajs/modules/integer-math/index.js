// SPDX-License-Identifier: Apache-2.0
// Exact Q16.16 arithmetic with unsigned 16-bit radix quotients.
// Every authoritative result is checked, never wrapped or saturated.
export const SCALE = 1 << 16;
export const INT_MIN = -2147483648;
export const INT_MAX = 2147483647;

const BASE = 65536;
const UNSIGNED_MAX = 4294967295;

export function int32(value, name = 'value') {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < INT_MIN || value > INT_MAX) {
    throw new RangeError(name + ' must be a signed 32-bit integer');
  }
  return value || 0;
}

export function uint32(value, name = 'value') {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < 0 || value > UNSIGNED_MAX) {
    throw new RangeError(name + ' must be an unsigned 32-bit integer');
  }
  return value || 0;
}

export function vector3(value, name = 'vector') {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(name + ' must be an array of three integers');
  }
  return [int32(value[0], name + '[0]'),
          int32(value[1], name + '[1]'),
          int32(value[2], name + '[2]')];
}

export function add(a, b) {
  return int32(int32(a) + int32(b), 'sum');
}
export function subtract(a, b) {
  return int32(int32(a) - int32(b), 'difference');
}

/** Multiply nonnegative signed-int32 magnitudes into two exact uint32 words. */
function productWords(a, b) {
  const a0 = a % BASE, a1 = Math.floor(a / BASE);
  const b0 = b % BASE, b1 = Math.floor(b / BASE);
  const bottom = a0 * b0;
  const cross = Math.floor(bottom / BASE) + a1 * b0 + a0 * b1;
  const low = (bottom % BASE) + (cross % BASE) * BASE;
  const high = a1 * b1 + Math.floor(cross / BASE);
  return [high, low];
}

/**
 * Four-digit radix-65536 long division with exact correction.
 * Each expanded remainder is < divisor * BASE <= 2^47, so expanded,
 * trial * divisor and all adjustment comparisons are exact Numbers.
 * A floating quotient is only a digit estimate, never the final authority.
 */
function checkedQuotient(high, low, divisor, negative) {
  let remainder = 0;
  let magnitude = 0;
  for (let i = 3; i >= 0; i--) {
    const digit = i === 3 ? Math.floor(high / BASE)
      : i === 2 ? high % BASE
      : i === 1 ? Math.floor(low / BASE) : low % BASE;
    const dividend = remainder * BASE + digit;
    let part = Math.min(BASE - 1, Math.floor(dividend / divisor));
    // Multiplication and comparison below are exact even if '/' rounded
    // an estimate across an integer boundary.
    while (part * divisor > dividend) part--;
    while ((part + 1) * divisor <= dividend) part++;
    remainder = dividend - part * divisor;
    if (i >= 2) {
      if (part !== 0) throw new RangeError('quotient must be a signed 32-bit integer');
    } else {
      magnitude = magnitude * BASE + part;
    }
  }
  const bound = negative ? -INT_MIN : INT_MAX;
  if (magnitude > bound) {
    throw new RangeError('quotient must be a signed 32-bit integer');
  }
  return magnitude === 0 ? 0 : negative ? -magnitude : magnitude;
}

/** Exact signed int32 truncation of a*b/denominator, with checked overflow. */
export function mulDiv(a, b, denominator) {
  a = int32(a);
  b = int32(b);
  denominator = int32(denominator);
  if (denominator === 0) throw new RangeError('division by zero');
  if (a === 0 || b === 0) return 0;

  const negative = (a < 0) !== (b < 0) !== (denominator < 0);
  const left = Math.abs(a), right = Math.abs(b), divisor = Math.abs(denominator);
  const direct = left * right;
  // All integer products in the safe range are exactly represented.
  // The remainder of two safe integers is exact as well; dividing the
  // exact multiple reconstructs an integer without FP quotient rounding.
  if (Number.isSafeInteger(direct)) {
    const quotient = (direct - direct % divisor) / divisor;
    const bound = negative ? -INT_MIN : INT_MAX;
    if (quotient > bound) {
      throw new RangeError('quotient must be a signed 32-bit integer');
    }
    return quotient === 0 ? 0 : negative ? -quotient : quotient;
  }
  const [high, low] = productWords(left, right);
  return checkedQuotient(high, low, divisor, negative);
}

export function fromRatio(numerator, denominator = 1) {
  return mulDiv(numerator, SCALE, denominator);
}
export function multiply(a, b) {
  return mulDiv(a, b, SCALE);
}
export function divide(a, b) {
  return mulDiv(a, SCALE, b);
}

/** Use a fast estimate but accept only an exact integer-square bracket. */
export function sqrt(value) {
  value = int32(value);
  if (value < 0) throw new RangeError('negative square root');
  const radicand = value * BASE; // < 2^47 (exact)
  let root = Math.floor(Math.sqrt(radicand));
  // All trial squares < 2^48, within Number's exact integer range.
  while (root * root > radicand) root--;
  while ((root + 1) * (root + 1) <= radicand) root++;
  return root;
}

export function toNumber(value) {
  return int32(value) / SCALE;
}
export function nextRandom(state) {
  state = uint32(state, 'random state');
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
