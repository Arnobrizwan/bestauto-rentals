/* ---------------------------------------------------------------------------
   Outbox delivery policy.

   The retry decision — how long to wait, and when to give up — used to live
   inline in the repository's UPDATE, which meant the only way to exercise it
   was against a database. It is a pure function of (attempts, error), so it
   lives here and the repository applies what it returns. Tests can then assert
   the state machine directly: exponential growth, the one-hour ceiling, and
   the exact attempt at which a message dies.
--------------------------------------------------------------------------- */

/** A message is abandoned after this many failed attempts. */
export const MAX_OUTBOX_ATTEMPTS = 6;

/** First retry waits a minute; each subsequent one doubles. */
const BASE_BACKOFF_MS = 30_000;

/** However bad the outage, a message is retried at least once an hour. */
export const MAX_BACKOFF_MS = 60 * 60_000;

/** How much of a vendor error is worth keeping. Matches the column width. */
const MAX_ERROR_LENGTH = 500;

export type OutboxRetryPlan = {
  /** The attempt count after recording this failure. */
  attempts: number;
  /** True once the message has exhausted `maxAttempts` and will not be retried. */
  dead: boolean;
  status: "queued" | "dead";
  /** Truncated to what the column holds, so a verbose vendor cannot overflow it. */
  lastError: string;
  backoffMs: number;
};

/**
 * Decides what happens to a message that just failed to deliver.
 *
 * Backoff is exponential so a provider having a bad minute is not hammered,
 * and capped so a long outage still drains within an hour of recovering. A
 * message that has used all its attempts becomes `dead` rather than queueing
 * forever, which is what makes a permanent failure visible on the Automations
 * page instead of a silent retry loop.
 */
export function planOutboxRetry(
  attempts: number,
  error: string,
  maxAttempts: number = MAX_OUTBOX_ATTEMPTS,
): OutboxRetryPlan {
  const next = attempts + 1;
  const dead = next >= maxAttempts;
  return {
    attempts: next,
    dead,
    status: dead ? "dead" : "queued",
    lastError: error.slice(0, MAX_ERROR_LENGTH),
    backoffMs: Math.min(MAX_BACKOFF_MS, 2 ** next * BASE_BACKOFF_MS),
  };
}
