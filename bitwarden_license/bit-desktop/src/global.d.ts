declare module "forcefocus";
declare const ipc: typeof import("./preload").ipc;

/**
 * Will be turned into a constant string in the main process only
 * likely either `"development"` or `"production"`.
 *
 * This is done using the `DefinePlugin` in our webpack files.
 */
declare const BIT_ENVIRONMENT: string;
