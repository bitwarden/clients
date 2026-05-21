/**
 * Single-use replay-protection tokens.
 *
 * Background mints a nonce per outbound sensitive request; the receiver consumes
 * exactly once. A second consume — by anyone — returns false. Expired entries
 * (`ttlMs` old) are likewise rejected.
 *
 * **Domain separation:** nonces and FrameSecrets are disjoint primitives. A
 * FrameSecret authenticates the identity of a frame across many messages; a nonce
 * proves freshness of a single message. Never share generators or storage.
 */

const NONCE_BYTES = 32;

const base64url = (bytes: Uint8Array): string => {
  let raw = "";
  for (const b of bytes) {
    raw += String.fromCharCode(b);
  }
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const generateNonce = (): string => {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
};

const now = (): number => Date.now();

export class NonceStore {
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly ttlMs = 30_000,
    private readonly capacity = 10_000,
  ) {}

  /** Mint a fresh nonce and record its expiry. */
  mint(): string {
    if (this.entries.size >= this.capacity) {
      this.evictOldest();
    }
    const nonce = generateNonce();
    this.entries.set(nonce, now() + this.ttlMs);
    return nonce;
  }

  /**
   * Returns true iff `nonce` was minted here, hasn't been consumed before, and is
   * within TTL. Subsequent calls with the same nonce always return false.
   */
  consume(nonce: string): boolean {
    const expiry = this.entries.get(nonce);
    if (expiry === undefined) {
      return false;
    }
    // Delete first so a concurrent (microtask-interleaved) second consume cannot
    // see the entry. There's no real concurrency in JS but the order matches the
    // single-use semantics regardless.
    this.entries.delete(nonce);
    return expiry > now();
  }

  /** Test seam. */
  __size(): number {
    return this.entries.size;
  }

  private evictOldest(): void {
    // Map preserves insertion order, and nonces are minted with the same TTL,
    // so the first entry is the closest to expiry. Drop one to make room.
    const first = this.entries.keys().next();
    if (!first.done) {
      this.entries.delete(first.value);
    }
  }
}
