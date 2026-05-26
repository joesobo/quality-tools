const ANSI_PATTERN = new RegExp(
  `${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  'g',
);
const PROGRESS_PATTERN =
  /Mutation testing\s+(?:\[(?<bracketStatus>[^\]]*)\]\s*)?(?<percent>\d+%)\s+\((?<timing>elapsed:[^)]+)\)\s+(?<count>\d+\/\d+)\s+(?:Mutants?|tested)(?:\s+\((?<tailStatus>\d+\s+survived,\s*\d+\s+timed out)\))?/i;
const STATUS_TAIL_PATTERN = /(?:^|\s)tested\s+\((?<status>\d+\s+survived,\s*\d+\s+timed out)\)\s*$/i;

export interface MutationProgressSnapshot {
  count: string;
  percent: string;
  status?: string;
  timing: string;
}

function cleanProgressText(text: string): string {
  return text.replace(ANSI_PATTERN, '').trim();
}

function normalizeStatus(status: string | undefined): string | undefined {
  const trimmed = status?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export class MutationProgressTracker {
  private latest?: MutationProgressSnapshot;

  formatLatest(): string | undefined {
    if (!this.latest) {
      return undefined;
    }

    return [
      'Mutation testing',
      `[${this.latest.status ?? ''}]`,
      this.latest.percent,
      `(${this.latest.timing})`,
      this.latest.count,
      'Mutants',
    ].join(' ');
  }

  observe(text: string): boolean {
    const cleanText = cleanProgressText(text);
    if (cleanText.length === 0) {
      return false;
    }

    const progressMatch = PROGRESS_PATTERN.exec(cleanText);
    if (progressMatch?.groups) {
      this.latest = {
        count: progressMatch.groups.count,
        percent: progressMatch.groups.percent,
        timing: progressMatch.groups.timing,
        status: normalizeStatus(progressMatch.groups.tailStatus)
          ?? normalizeStatus(progressMatch.groups.bracketStatus)
          ?? this.latest?.status,
      };
      return true;
    }

    const statusMatch = STATUS_TAIL_PATTERN.exec(cleanText);
    if (statusMatch?.groups && this.latest) {
      this.latest = {
        ...this.latest,
        status: normalizeStatus(statusMatch.groups.status) ?? this.latest.status,
      };
      return true;
    }

    return false;
  }
}

export function createMutationProgressOutputForwarder(
  tracker: MutationProgressTracker,
  writeOutput: (text: string) => void,
): { flush(): void; write(text: string): void } {
  let pending = '';

  const handleSegment = (segment: string, delimiter: string): void => {
    if (tracker.observe(segment)) {
      return;
    }

    writeOutput(`${segment}${delimiter}`);
  };

  const flushPendingProgress = (): boolean => {
    if (tracker.observe(pending)) {
      pending = '';
      return true;
    }

    return false;
  };

  return {
    flush() {
      if (pending.length === 0 || flushPendingProgress()) {
        return;
      }

      writeOutput(pending);
      pending = '';
    },
    write(text: string) {
      pending += text;

      let delimiterIndex = pending.search(/[\r\n]/);
      while (delimiterIndex >= 0) {
        const segment = pending.slice(0, delimiterIndex);
        const delimiter = pending[delimiterIndex] === '\n' ? '\n' : '';
        pending = pending.slice(delimiterIndex + 1);
        handleSegment(segment, delimiter);
        delimiterIndex = pending.search(/[\r\n]/);
      }

      flushPendingProgress();
    },
  };
}
