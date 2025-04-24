/**
 * @deprecated instead use `SecureNoteTypes` constants and `SecureNoteTypeValue` type over unsafe typescript enums
 **/
export enum SecureNoteType {
  Generic = 0,
}

export const SecureNoteTypes = {
  Generic: 0,
} as const;

export type SecureNoteTypeValue = (typeof SecureNoteTypes)[keyof typeof SecureNoteTypes];
