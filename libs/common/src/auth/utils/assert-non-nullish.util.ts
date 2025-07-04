/**
 * Asserts that a value is non-nullish (not `null` or `undefined`); throws if value is nullish.
 *
 * @param val the value to check
 * @param name the name of the value to include in the error message
 * @param ctx context to optionally append to the error message
 * @throws if the value is null or undefined
 *
 * @example
 *
 * ```
 *    // `newPasswordHint` can have an empty string as a valid value, so we check non-nullish
 *    this.assertNonNullish(
 *      passwordInputResult.newPasswordHint,
 *      "newPasswordHint",
 *      "Could not set initial password."
 *    );
 *    // Output error message: "newPasswordHint is null or undefined. Could not set initial password."
 * ```
 *
 * @remarks
 *
 * If you use this method repeatedly to check several values, it may help to assign any
 * additional context (`ctx`) to a variable and pass it in to each call. This prevents the
 * call from reformatting vertically via prettier in your text editor, taking up multiple lines.
 *
 * For example:
 * ```
 *    const ctx = "Could not set initial password.";
 *
 *    this.assertNonNullish(valueOne, "valueOne", ctx);
 *    this.assertNonNullish(valueTwo, "valueTwo", ctx);
 *    this.assertNonNullish(valueThree, "valueThree", ctx);
 * ```
 */
export function assertNonNullish<T>(
  val: T,
  name: string,
  ctx?: string,
): asserts val is NonNullable<T> {
  if (val == null) {
    // If context is provided, append it to the error message with a space before it.
    throw new Error(`${name} is null or undefined.${ctx ? ` ${ctx}` : ""}`);
  }
}
