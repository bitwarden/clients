// Note: the below comments are just for documenting what they used to be.
export const VaultTimeoutStringType = {
  Never: "never", // null
  OnRestart: "onRestart", // -1
  OnLocked: "onLocked", // -2
  OnSleep: "onSleep", // -3
  OnIdle: "onIdle", // -4
} as const;

export type VaultTimeout =
  | number // 0 or positive numbers only
  | (typeof VaultTimeoutStringType)[keyof typeof VaultTimeoutStringType];

export interface VaultTimeoutOption {
  name: string;
  value: VaultTimeout;
}
