export const SendTypeRestriction = Object.freeze({
  /** Allow only Text Sends */
  TextOnly: 0,
  /** Allow only File Sends */
  FileOnly: 1,
} as const);
export type SendTypeRestriction = (typeof SendTypeRestriction)[keyof typeof SendTypeRestriction];
