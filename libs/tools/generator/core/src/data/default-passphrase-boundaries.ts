function initializeBoundaries() {
  const numWords = Object.freeze({
    min: 3,
    max: 20,
  });

  return Object.freeze({
    numWords,
  });
}

/** Immutable default boundaries for passphrase generation.
 * These are used when the policy does not override a value.
 */
export const DefaultPassphraseBoundaries = initializeBoundaries();
