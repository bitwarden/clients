const _FieldType = Object.freeze({
  Text: 0,
  Hidden: 1,
  Boolean: 2,
  Linked: 3,
} as const);

type _FieldType = typeof _FieldType;

export type FieldType = _FieldType[keyof _FieldType];

export const FieldType: Record<keyof _FieldType, FieldType> = _FieldType;
