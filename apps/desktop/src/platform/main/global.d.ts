/**
 * Will be turned into a constant string in the main process only
 * likely either `"stable"` or `"beta"`.
 *
 * This is done using the `DefinePlugin` in our webpack files.
 */
declare const BIT_RELEASE_CHANNEL: "stable" | "beta";