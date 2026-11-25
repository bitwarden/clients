/** How `CipherService.updateWithServer` saves a change to an existing cipher. */
export const CipherUpdateRoute = Object.freeze({
  /** Fields that belong to the user, not the item (folder, favorite). No edit permission, no secrets. */
  UserFields: "user-fields",
  /** A full item edit: the stored original if it is full, else the supplied original. */
  Item: "item",
} as const);
export type CipherUpdateRoute = (typeof CipherUpdateRoute)[keyof typeof CipherUpdateRoute];
