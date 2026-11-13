/**
 * Non-Angular code for the `bw privileged-controls request` group: the SDK calls, the choice of path for
 * `create`, and the folding of extension requests for `list`. Relative imports only, and
 * `import type` for every SDK type, so Jest never loads wasm.
 */
export * from "./access-request-list";
export * from "./access-requests.service";
export * from "./create-access-request";
