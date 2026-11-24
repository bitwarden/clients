import { SceneTemplate } from "../scene";

/** The server's `Bit.Core.Enums.OrganizationUserType`, which the SeederApi reads as numbers. */
export const OrganizationUserType = Object.freeze({
  Owner: 0,
  Admin: 1,
  User: 2,
  Custom: 4,
} as const);
export type OrganizationUserType = (typeof OrganizationUserType)[keyof typeof OrganizationUserType];

/** The server's `Bit.Core.Enums.OrganizationUserStatusType`, which the SeederApi reads as numbers. */
export const OrganizationUserStatusType = Object.freeze({
  Revoked: -1,
  Invited: 0,
  Accepted: 1,
  Confirmed: 2,
} as const);
export type OrganizationUserStatusType =
  (typeof OrganizationUserStatusType)[keyof typeof OrganizationUserStatusType];

/** See `OrganizationUserScene.Request` in the server's util/Seeder/Scenes. */
export type OrganizationUserArgs = {
  /** A seeded user, e.g. `SingleUserScene`'s `userId`. */
  userId: string;
  organizationId: string;
  /** `SingleOrganizationScene`'s `organizationKeyB64`, encrypted to a confirmed member. */
  organizationKeyB64: string;
  organizationUserType: OrganizationUserType;
  organizationUserStatusType: OrganizationUserStatusType;
  accessSecretsManager?: boolean;
  /** The member's PAM license. Unset follows the organization's `usePam`. */
  accessPam?: boolean;
  /** `SingleUserScene`'s `decryptedKeyB64`, to enroll the member in account recovery. */
  userKeyB64?: string;
};

/** See `OrganizationUserSceneResult` in the server's util/Seeder/Scenes. */
export type OrganizationUserResult = {
  organizationUserId: string;
};

/** An existing user's membership of an existing organization. */
export class OrganizationUserScene extends SceneTemplate<
  OrganizationUserArgs,
  OrganizationUserResult
> {
  readonly template = "OrganizationUserScene";
}
