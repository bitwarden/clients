/**
 * The kind of connected app a record represents. Agent access is the only type today; the
 * discriminator lets other "connected app" integrations reuse the same storage later.
 */
export const ConnectedAppType = Object.freeze({
  AgentAccess: 1,
} as const);

export type ConnectedAppType = (typeof ConnectedAppType)[keyof typeof ConnectedAppType];
