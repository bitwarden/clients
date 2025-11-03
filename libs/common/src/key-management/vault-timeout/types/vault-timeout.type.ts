// Note: the below comments are just for documenting what they used to be.
export const VaultTimeoutStringType = {
  Never: "never", // null
  OnRestart: "onRestart", // -1
  OnLocked: "onLocked", // -2
  OnSleep: "onSleep", // -3
  OnIdle: "onIdle", // -4
  Custom: "custom", // -100
} as const;

export const VaultTimeoutNumberType = {
  Immediately: 0,
  OnMinute: 1,
};

export type VaultTimeout =
  | number // 0 or positive numbers only
  | (typeof VaultTimeoutNumberType)[keyof typeof VaultTimeoutNumberType]
  | (typeof VaultTimeoutStringType)[keyof typeof VaultTimeoutStringType];

export interface VaultTimeoutOption {
  name: string;
  value: VaultTimeout;
}

export function isVaultTimeoutTypeNumeric(timeout: VaultTimeout): boolean {
  return typeof timeout === "number";
}
