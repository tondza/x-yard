/**
 * Deterministic, injectable randomness.
 *
 * GAME_VISION.md §2 requires xorshift128+ with its state living *inside*
 * `GameState` as `[number, number, number, number]`, so the API here is a set of
 * PURE functions over an explicit {@link RngState} rather than a stateful
 * closure. A closure would carry hidden mutable state that replay could not
 * reconstruct from the event log.
 *
 * `Math.random`, `Date.now`, and `crypto` are banned in this package.
 *
 * @module @x-yard/game-core/rng
 */

/** xorshift128+ state: four unsigned 32-bit words. JSON-serializable. */
export type RngState = readonly [number, number, number, number];

/** A draw: the next state plus the value produced. */
export interface Draw {
  readonly state: RngState;
  readonly value: number;
}

/** A collective draw: the next state plus the resulting array. */
export interface ShuffleResult<T> {
  readonly state: RngState;
  readonly items: readonly T[];
}

/**
 * Expand a single number into a full 128-bit state (splitmix32).
 *
 * A naive `[seed, 0, 0, 0]` state is a known weakness of xorshift: the first
 * outputs stay small. splitmix32 mixes the seed across all four words so that
 * low seeds do not correlate with low first draws.
 *
 * @throws RangeError when `seed` is not finite
 */
export function seedRngState(seed: number): RngState {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`RNG seed must be finite, received ${String(seed)}`);
  }

  let z = Math.trunc(seed) >>> 0;
  const words: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    z = (z + 0x9e3779b9) >>> 0;
    let t = z;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0;
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0;
    t = (t ^ (t >>> 15)) >>> 0;
    words.push(t);
  }

  // A zero state is a fixed point for xorshift; force it away from zero.
  // The explicit `: boolean` matters: without it TypeScript infers a type guard
  // from the predicate and narrows `words` to `0[]`, making the assignment fail.
  const allZero: boolean = words.every((word) => word === 0);
  if (allZero) words[0] = 0x9e3779b9;

  return [words[0] as number, words[1] as number, words[2] as number, words[3] as number];
}

/**
 * Advance the generator, returning the next state and a value in `[0, 1)`.
 */
export function nextRandom(state: RngState): Draw {
  let [x, y, z, w] = state;

  const t = (x ^ (x << 11)) >>> 0;
  x = y;
  y = z;
  z = w;
  w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;

  return { state: [x, y, z, w], value: w / 4294967296 };
}

/** A draw yielding a uniform integer in `[0, maxExclusive)`. */
export interface IntDraw {
  readonly state: RngState;
  readonly value: number;
}

/**
 * Advance the generator, returning an integer in `[0, maxExclusive)`.
 *
 * @throws RangeError when `maxExclusive` is not a positive integer
 */
export function randomInt(state: RngState, maxExclusive: number): IntDraw {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`maxExclusive must be a positive integer, received ${String(maxExclusive)}`);
  }
  const draw = nextRandom(state);
  return { state: draw.state, value: Math.floor(draw.value * maxExclusive) };
}

/**
 * Choose one element uniformly.
 *
 * @throws RangeError on an empty list
 */
export function pickRandom<T>(state: RngState, items: readonly T[]): { readonly state: RngState; readonly value: T } {
  if (items.length === 0) {
    throw new RangeError('cannot pick from an empty list');
  }
  const draw = randomInt(state, items.length);
  // Bounds are guaranteed by randomInt; the cast satisfies noUncheckedIndexedAccess.
  return { state: draw.state, value: items[draw.value] as T };
}

/**
 * Fisher-Yates shuffle. Pure: the input array is never mutated.
 */
export function shuffleWith<T>(state: RngState, items: readonly T[]): ShuffleResult<T> {
  const out = [...items];
  let current = state;

  for (let i = out.length - 1; i > 0; i -= 1) {
    const draw = randomInt(current, i + 1);
    current = draw.state;
    const a = out[i] as T;
    const b = out[draw.value] as T;
    out[i] = b;
    out[draw.value] = a;
  }

  return { state: current, items: out };
}

/**
 * Structural guard for state loaded from JSON or a client.
 *
 * Replay must reject a corrupt `rngState` loudly rather than silently producing
 * a different match.
 */
export function isRngState(value: unknown): value is RngState {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffffffff)
  );
}
