let queue: Promise<unknown> = Promise.resolve();

/**
 * Gnani's speech APIs allow one active request per key. Serialise calls inside
 * this Node process so the demo never trips the rate limit when voice playback
 * and microphone transcription overlap.
 */
export function enqueueGnani<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export async function withRateLimitRetry<T>(
  task: () => Promise<T>,
  isRateLimited: (value: T) => boolean,
  attempts = 6
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const value = await task();
      if (!isRateLimited(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
    }
  }
  if (lastError) throw lastError;
  return task();
}
