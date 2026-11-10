export interface WipeTarget {
  id: string;
  /** Erases what the target stores; throws if it could not be erased. */
  clearData(): void;
}

export interface WipeFailure {
  id: string;
  error: unknown;
}

/** Erases every target; one failing target must not stop the rest. */
export function wipeAll(targets: WipeTarget[]): { failed: number; failures: WipeFailure[] } {
  const failures: WipeFailure[] = [];
  for (const target of targets) {
    try {
      target.clearData();
    } catch (error) {
      failures.push({ id: target.id, error });
    }
  }
  return { failed: failures.length, failures };
}
