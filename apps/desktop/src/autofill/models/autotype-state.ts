/**
 * Represents the possible Autotype states for the current user:
 * - `Disabled` - Autotype is off
 * - `Mvp` - Autotype MVP, the `WindowsDesktopAutotype` FF
 * - `Ga` - Autotype GA, the `WindowsDesktopAutotypeGA` FF
 */
export const AutotypeState = Object.freeze({
  Disabled: "disabled",
  // MVP, delete with PM-41067
  Mvp: "mvp",
  Ga: "ga",
} as const);
export type AutotypeState = (typeof AutotypeState)[keyof typeof AutotypeState];
