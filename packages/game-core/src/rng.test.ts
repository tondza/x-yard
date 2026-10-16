import { describe, expect, it } from 'vitest';

import {
  isRngState,
  nextRandom,
  pickRandom,
  randomInt,
  seedRngState,
  shuffleWith,
} from './rng';

/**
 * Golden vectors lock the exact xorshift128+ output. GAME_VISION.md §8 requires
 * them so that a future refactor which silently changes the RNG stream is
 * caught immediately — such a change would invalidate every stored replay.
 */
const GOLDEN = {
  seed42State: [551831576, 144025891, 322543647, 3034809370],
  seed42Floats: [
    0.712001686450094, 0.07514603715389967, 0.8041328443214297, 0.3972192166838795,
    0.9946078786160797,
  ],
  seed7Ints: [8, 8, 9, 3, 1],
  seed99Shuffle: [1, 4, 5, 3, 6, 8, 7, 2],
} as const;

describe('seedRngState', () => {
  it('matches the golden vector for seed 42', () => {
    expect(seedRngState(42)).toEqual(GOLDEN.seed42State);
  });

  it('rejects a non-finite seed', () => {
    expect(() => seedRngState(Number.NaN)).toThrow(RangeError);
    expect(() => seedRngState(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('never yields the all-zero state, which xorshift cannot escape', () => {
    for (const seed of [0, 1, 2, 42, 65535]) {
      expect(seedRngState(seed).some((word) => word !== 0)).toBe(true);
    }
  });

  it('expands a low seed across all four words', () => {
    // A naive [seed,0,0,0] state would leave three words at zero.
    expect(seedRngState(1).filter((word) => word !== 0).length).toBeGreaterThan(1);
  });
});

describe('nextRandom', () => {
  it('matches the golden float sequence for seed 42', () => {
    let state = seedRngState(42);
    const values: number[] = [];
    for (let i = 0; i < GOLDEN.seed42Floats.length; i += 1) {
      const draw = nextRandom(state);
      values.push(draw.value);
      state = draw.state;
    }
    expect(values).toEqual([...GOLDEN.seed42Floats]);
  });

  it('is deterministic for one seed', () => {
    const a = nextRandom(seedRngState(1234));
    const b = nextRandom(seedRngState(1234));
    expect(a.value).toBe(b.value);
    expect(a.state).toEqual(b.state);
  });

  it('stays within [0, 1)', () => {
    let state = seedRngState(99);
    for (let i = 0; i < 1000; i += 1) {
      const draw = nextRandom(state);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(1);
      state = draw.state;
    }
  });

  it('round-trips through a serialized state', () => {
    // This is what replay depends on: state saved to JSON resumes identically.
    const first = nextRandom(seedRngState(42));
    const second = nextRandom(first.state);
    const restored = JSON.parse(JSON.stringify(first.state)) as unknown;
    expect(isRngState(restored)).toBe(true);
    if (!isRngState(restored)) return;
    expect(nextRandom(restored).value).toBe(second.value);
  });

  it('advances the state on every draw', () => {
    const start = seedRngState(5);
    expect(nextRandom(start).state).not.toEqual(start);
  });
});

describe('randomInt', () => {
  it('matches the golden integer sequence for seed 7', () => {
    let state = seedRngState(7);
    const values: number[] = [];
    for (let i = 0; i < GOLDEN.seed7Ints.length; i += 1) {
      const draw = randomInt(state, 10);
      values.push(draw.value);
      state = draw.state;
    }
    expect(values).toEqual([...GOLDEN.seed7Ints]);
  });

  it('stays within [0, maxExclusive)', () => {
    let state = seedRngState(4242);
    for (let i = 0; i < 1000; i += 1) {
      const draw = randomInt(state, 6);
      expect(Number.isInteger(draw.value)).toBe(true);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(6);
      state = draw.state;
    }
  });

  it('rejects a non-positive or fractional bound', () => {
    const state = seedRngState(1);
    expect(() => randomInt(state, 0)).toThrow(RangeError);
    expect(() => randomInt(state, -1)).toThrow(RangeError);
    expect(() => randomInt(state, 2.5)).toThrow(RangeError);
  });
});

describe('pickRandom', () => {
  it('returns an element of the list', () => {
    const items = ['taxi', 'bus', 'underground', 'special'] as const;
    expect(items).toContain(pickRandom(seedRngState(5), items).value);
  });

  it('throws on an empty list', () => {
    expect(() => pickRandom(seedRngState(5), [])).toThrow(RangeError);
  });
});

describe('shuffleWith', () => {
  it('matches the golden shuffle for seed 99', () => {
    expect([...shuffleWith(seedRngState(99), [1, 2, 3, 4, 5, 6, 7, 8]).items]).toEqual([
      ...GOLDEN.seed99Shuffle,
    ]);
  });

  it('preserves the multiset of elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = shuffleWith(seedRngState(11), input).items;
    expect([...output].sort((x, y) => x - y)).toEqual(input);
  });

  it('does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffleWith(seedRngState(11), input);
    expect(input).toEqual(snapshot);
  });

  it('is reproducible for one seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(shuffleWith(seedRngState(2024), input).items).toEqual(
      shuffleWith(seedRngState(2024), input).items,
    );
  });
});

describe('isRngState', () => {
  it('accepts a valid four-word state', () => {
    expect(isRngState([1, 2, 3, 4])).toBe(true);
  });

  it('rejects malformed states', () => {
    expect(isRngState([1, 2, 3])).toBe(false);
    expect(isRngState([1, 2, 3, 4, 5])).toBe(false);
    expect(isRngState([1, 2, 3, -1])).toBe(false);
    expect(isRngState([1, 2, 3, 2 ** 33])).toBe(false);
    expect(isRngState([1, 2, 3, 4.5])).toBe(false);
    expect(isRngState('nope')).toBe(false);
    expect(isRngState(null)).toBe(false);
  });
});
