import { randomUUID } from "node:crypto";

import { Account } from "../../credentials";
import { Play } from "../../seeder/play";
import {
  OrganizationUserScene,
  OrganizationUserStatusType,
  OrganizationUserType,
} from "../../seeder/scenes/organization-user.scene";
import { PlanType, SingleOrganizationScene } from "../../seeder/scenes/single-organization.scene";
import { seededAccount, SingleUserScene } from "../../seeder/scenes/single-user.scene";

export type PamOrganization = {
  owner: Account;
  ownerUserId: string;
  organizationId: string;
  organizationKeyB64: string;
};

export type PamMember = {
  account: Account;
  organizationUserId: string;
};

/**
 * An organization with PAM and its owner. The server must have the `pm-37044-pam-v-0` flag on,
 * since it gates the PAM endpoints.
 */
export async function seedPamOrganization(play: Play): Promise<PamOrganization> {
  const owner = await play.scene(
    new SingleUserScene({ email: "pam-owner@example.com", password: randomUUID() }),
  );
  const organization = await play.scene(
    new SingleOrganizationScene({
      ownerUserId: owner.result.userId,
      planType: PlanType.EnterpriseAnnually,
      name: "PAM org",
      domain: "pam.example.com",
      seats: 5,
      overrides: { usePam: true },
    }),
  );

  return {
    owner: seededAccount(owner),
    ownerUserId: owner.result.userId,
    organizationId: organization.result.organizationId,
    organizationKeyB64: organization.result.organizationKeyB64,
  };
}

/** A confirmed member of the organization, with a PAM license unless `accessPam` is false. */
export async function seedPamMember(
  play: Play,
  organization: PamOrganization,
  { accessPam }: { accessPam?: boolean } = {},
): Promise<PamMember> {
  const user = await play.scene(
    new SingleUserScene({ email: "pam-member@example.com", password: randomUUID() }),
  );
  const membership = await play.scene(
    new OrganizationUserScene({
      userId: user.result.userId,
      organizationId: organization.organizationId,
      organizationKeyB64: organization.organizationKeyB64,
      organizationUserType: OrganizationUserType.User,
      organizationUserStatusType: OrganizationUserStatusType.Confirmed,
      accessPam,
    }),
  );

  return {
    account: seededAccount(user),
    organizationUserId: membership.result.organizationUserId,
  };
}
