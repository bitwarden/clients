export const AgentAccessPromptType = Object.freeze({
  Always: "always",
  RememberUntilLock: "rememberUntilLock",
} as const);
export type AgentAccessPromptType =
  (typeof AgentAccessPromptType)[keyof typeof AgentAccessPromptType];
