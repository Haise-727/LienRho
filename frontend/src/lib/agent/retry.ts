import pRetry from "p-retry";

export interface RetryConfig {
  retries: number;
  minTimeout: number;
  maxTimeout: number;
  factor: number;
  jitter: boolean;
}

export const defaultRetryConfig: RetryConfig = {
  retries: Number(process.env.NEXT_PUBLIC_AGENT_RETRIES) || 3,
  minTimeout: Number(process.env.NEXT_PUBLIC_AGENT_RETRY_MIN_TIMEOUT) || 500,
  maxTimeout: Number(process.env.NEXT_PUBLIC_AGENT_RETRY_MAX_TIMEOUT) || 10_000,
  factor: 2,
  jitter: true,
};

export function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> & { onRetry?: (attempt: number) => void } = {},
): Promise<T> {
  const { retries, minTimeout, maxTimeout, factor, onRetry } = {
    ...defaultRetryConfig,
    ...config,
  };

  return pRetry(fn, {
    retries,
    minTimeout,
    maxTimeout,
    factor,
    onFailedAttempt: (context) => {
      onRetry?.(context.attemptNumber);
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[retry] attempt ${context.attemptNumber} failed: ${context.error.message}`,
        );
      }
    },
  });
}