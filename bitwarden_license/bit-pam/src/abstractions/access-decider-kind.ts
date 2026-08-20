/**
 * Who made a decision on an access request: a human approver, or an automatic condition evaluation
 * (an access rule). The discriminator on each {@link Decision} in an access request's decision log.
 */
export const AccessDeciderKind = Object.freeze({
  Human: "human",
  Automatic: "automatic",
} as const);
export type AccessDeciderKind = (typeof AccessDeciderKind)[keyof typeof AccessDeciderKind];
