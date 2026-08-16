/**
 * App-level configuration. Deliberately a single, small, auditable file —
 * the public repo lets users verify exactly what Kairo points at (ADR-005/006).
 */

/** Base URL of the NanoGPT API. */
export const NANOGPT_BASE_URL = 'https://nano-gpt.com/api'

/**
 * Referral link shown to users who don't have a NanoGPT account yet.
 * Signing up through it supports Kairo's development at no extra cost to the
 * user — it is Kairo's only monetization (ADR-005). Nothing is paywalled.
 */
export const NANOGPT_REFERRAL_URL = 'https://nano-gpt.com/r/BnfJfghE'

/** Where the user manages their NanoGPT API keys. */
export const NANOGPT_API_KEYS_URL = 'https://nano-gpt.com/api'

/** Public source repository (the "verify it yourself" link). */
// TODO(angel): replace with the real GitHub repo URL once public.
export const REPO_URL = 'https://github.com/'
