function initializeBoundaries() {
  const length = Object.freeze({
    min: 5,
    max: 128,
  });

  const minDigits = Object.freeze({
    min: 0,
    max: 9,
  });

  const minSpecialCharacters = Object.freeze({
    min: 0,
    max: 9,
  });

  return Object.freeze({
    length,
    minDigits,
    minSpecialCharacters,
  });
}

/** Immutable default boundaries for password generation.
 * These are used when the policy does not override a value.
 */
export const DefaultPasswordBoundaries = initializeBoundaries();
