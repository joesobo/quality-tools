import { describe, expect, it } from 'vitest';
import {
  createMutationProgressOutputForwarder,
  MutationProgressTracker,
} from '../../../src/mutation/runner/progress';

describe('mutation progress output', () => {
  it('normalizes Stryker progress with survived and timed-out counts', () => {
    const tracker = new MutationProgressTracker();

    expect(tracker.observe(
      'Mutation testing 37% (elapsed: <1m, remaining: <1m) 4/14 tested (0 survived, 0 timed out)',
    )).toBe(true);

    expect(tracker.formatLatest()).toBe(
      'Mutation testing [0 survived, 0 timed out] 37% (elapsed: <1m, remaining: <1m) 4/14 Mutants',
    );
  });

  it('combines split Stryker progress and status-tail fragments', () => {
    const tracker = new MutationProgressTracker();

    expect(tracker.observe(
      'Mutation testing  [] 11% (elapsed: ~7m, remaining: ~1h 1m) 762/4441 Mutants',
    )).toBe(true);
    expect(tracker.observe('tested (51 survived, 0 timed out)')).toBe(true);

    expect(tracker.formatLatest()).toBe(
      'Mutation testing [51 survived, 0 timed out] 11% (elapsed: ~7m, remaining: ~1h 1m) 762/4441 Mutants',
    );
  });

  it('suppresses raw Stryker progress while forwarding other output', () => {
    const tracker = new MutationProgressTracker();
    const forwarded: string[] = [];
    const forwarder = createMutationProgressOutputForwarder(tracker, text => forwarded.push(text));

    forwarder.write('11:00 INFO Instrumented 1 source file(s)\n');
    forwarder.write('Mutation testing 37% (elapsed: <1m, remaining: <1m) 4/14 tested (0 survived, 0 timed out)\n');
    forwarder.write('Done in 47 seconds.\n');
    forwarder.flush();

    expect(forwarded.join('')).toBe(
      '11:00 INFO Instrumented 1 source file(s)\nDone in 47 seconds.\n',
    );
    expect(tracker.formatLatest()).toBe(
      'Mutation testing [0 survived, 0 timed out] 37% (elapsed: <1m, remaining: <1m) 4/14 Mutants',
    );
  });
});
