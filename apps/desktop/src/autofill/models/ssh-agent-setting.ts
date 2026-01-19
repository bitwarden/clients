// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SshAgentPromptType {
  Always = "always",
  Never = "never",
  RememberUntilLock = "rememberUntilLock",
}

export const SshAgentKeySelectionMode = Object.freeze({
  AllKeys: "allKeys",
  SelectKey: "selectKey",
} as const);

export type SshAgentKeySelectionMode =
  (typeof SshAgentKeySelectionMode)[keyof typeof SshAgentKeySelectionMode];
