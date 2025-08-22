/**
 * Asserts that a value is truthy; throws if value is falsy.
 *
 * @param val the value to check
 * @param name the name of the value to include in the error message
 * @param ctx context to optionally append to the error message
 * @throws if the value is falsy (`false`, `""`, `0`, `null`, `undefined`, `void`, or `NaN`)
 *
 * @example
 *
 * ```
 *    this.assertTruthy(
 *      this.organizationId,
 *      "organizationId",
 *      "Could not set initial password."
 *    );
 *    // Output error message: "organizationId is falsy. Could not set initial password."
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
 *    this.assertTruthy(valueOne, "valueOne", ctx);
 *    this.assertTruthy(valueTwo, "valueTwo", ctx);
 *    this.assertTruthy(valueThree, "valueThree", ctx);
 */
export function assertTruthy<T>(
  val: T,
  name: string,
  ctx?: string,
): asserts val is Exclude<T, false | "" | 0 | null | undefined | void | 0n> {
  // Because `NaN` is a value (not a type) of type 'number', that means we cannot add
  // it to the list of falsy values in the type assertion. Instead, we check for it
  // separately at runtime.
  if (!val || (typeof val === "number" && Number.isNaN(val))) {
    // If context is provided, append it to the error message with a space before it.
    throw new Error(`${name} is falsy.${ctx ? ` ${ctx}` : ""}`);
  }
}
