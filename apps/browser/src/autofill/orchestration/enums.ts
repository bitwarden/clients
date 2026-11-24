/**
 * Who started a fill, which decides where its target comes from. A fill a transition report started
 * targets the report its request carries; a fill the user or a policy started targets the tab its
 * request carries. A fill's source ranks it against the fills it conflicts with (see
 * `lease/model.md`).
 */
export const TargetSource = Object.freeze({
  /** A transition report: an eager fill. It targets the report the fill request carries. */
  Reported: "reported",
  /** The user. The fill targets the tab the fill request carries. */
  User: "user",
  /** A policy. The fill targets the tab the fill request carries. */
  Policy: "policy",
} as const);
export type TargetSource = (typeof TargetSource)[keyof typeof TargetSource];
