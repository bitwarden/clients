import { SceneTemplate } from "../scene";

/** See `OrganizationCollectionScene.AccessSelectionRequest` in the server's util/Seeder/Scenes. */
export type CollectionAccessSelection = {
  /** The membership's id (`organizationUserId`), not the user's, or a group's id. */
  id: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
};

/** See `OrganizationCollectionScene.Request` in the server's util/Seeder/Scenes. */
export type OrganizationCollectionArgs = {
  organizationId: string;
  /** `SingleOrganizationScene`'s `organizationKeyB64`, which encrypts the name. */
  organizationKeyB64: string;
  /** Not mangled. */
  name: string;
  users?: CollectionAccessSelection[];
  groups?: CollectionAccessSelection[];
};

/** See `OrganizationCollectionScene.Result` in the server's util/Seeder/Scenes. */
export type OrganizationCollectionResult = {
  collectionId: string;
};

/** A collection, shown as a shared folder, with optional member and group access. */
export class OrganizationCollectionScene extends SceneTemplate<
  OrganizationCollectionArgs,
  OrganizationCollectionResult
> {
  readonly template = "OrganizationCollectionScene";
}
