import { SceneTemplate } from "../scene";

/** See `OrganizationLoginCipherScene.Request` in the server's util/Seeder/Scenes. */
export type OrganizationLoginCipherArgs = {
  /** A member of the organization, e.g. its owner. */
  userId: string;
  organizationId: string;
  /** `SingleOrganizationScene`'s `organizationKeyB64`, which encrypts the item. */
  organizationKeyB64: string;
  /** Not mangled. */
  name: string;
  username?: string;
  password?: string;
  uri?: string;
  notes?: string;
  collectionIds?: string[];
};

/** See `LoginCipherScene.Result` in the server's util/Seeder/Scenes. */
export type OrganizationLoginCipherResult = {
  cipherId: string;
};

/** A login item owned by an organization, in its collections. */
export class OrganizationLoginCipherScene extends SceneTemplate<
  OrganizationLoginCipherArgs,
  OrganizationLoginCipherResult
> {
  readonly template = "OrganizationLoginCipherScene";
}
