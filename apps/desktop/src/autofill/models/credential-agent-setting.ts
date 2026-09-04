/** When the desktop app asks the user to approve a credential request. */
export const CredentialAgentPromptType = Object.freeze({
  Always: "always",
  Never: "never",
  RememberUntilLock: "rememberUntilLock",
} as const);

export type CredentialAgentPromptType =
  (typeof CredentialAgentPromptType)[keyof typeof CredentialAgentPromptType];
