// Feedback prompt policy. The prompt is an occasional ask, never part of the first session or a recurring interruption.
export const PROMPT_COOLDOWN_MS = 3 * 24 * 3600 * 1000;
export const PROMPT_MIN_ACCOUNT_AGE_MS = 2 * 3600 * 1000;
/** @param {{now:number,lastSeen?:number,submittedAt?:number,accountCreated?:number}} o */
export function shouldPromptSuggestion({ now, lastSeen = 0, submittedAt = 0, accountCreated = 0 }) {
  if (submittedAt) return false;
  if (!accountCreated || now - accountCreated < PROMPT_MIN_ACCOUNT_AGE_MS) return false;
  return !lastSeen || now - lastSeen >= PROMPT_COOLDOWN_MS;
}
