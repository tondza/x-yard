/**
 * A tiny seeded-random facade over `game-core`'s xorshift128+.
 *
 * The generator threads one of these through every stage. It is a local
 * working object, not serialized state: the map is fully determined by its
 * seed and options. No `Math.random` is allowed anywhere in this package.
 *
 * @module @x-yard/map-generator/rng
 */

import { nextRandom, randomInt, seedRngState } from '@x-yard/game-core';
import type { RngState } from '@x-yard/game-core';

export interface Rng {
  /** A value in `[0, 1)`. */
  next(): number;
  /** An integer in `[0, maxExclusive)`. */
  int(maxExclusive: number): number;
  /** One item from a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** True with probability `probability`. */
  chance(probability: number): boolean;
  /** A symmetric jitter in `[-amount, amount]`. */
  jitter(amount: number): number;
}

/** Build a deterministic random stream from a seed. */
export function createRng(seed: number): Rng {
  let state: RngState = seedRngState(seed);

  const draw = (): number => {
    const next = nextRandom(state);
    state = next.state;
    return next.value;
  };

  return {
    next: draw,
    int(maxExclusive: number): number {
      const next = randomInt(state, maxExclusive);
      state = next.state;
      return next.value;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('cannot pick from an empty list');
      const next = randomInt(state, items.length);
      state = next.state;
      return items[next.value] as T;
    },
    chance(probability: number): boolean {
      return draw() < probability;
    },
    jitter(amount: number): number {
      return (draw() * 2 - 1) * amount;
    },
  };
}
