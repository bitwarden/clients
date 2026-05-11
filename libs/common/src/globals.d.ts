declare function escape(s: string): string;
declare function unescape(s: string): string;

/**
 * Will be turned into a constant string likely either `"stable"` or `"beta"`.
 *
 * This is done using the `DefinePlugin` in our webpack files.
 */
declare const BIT_RELEASE_CHANNEL: "stable" | "beta";