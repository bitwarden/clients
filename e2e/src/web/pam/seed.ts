import { randomUUID } from "node:crypto";

import { Account } from "../../credentials";
import { Play } from "../../seeder/play";
import { OrganizationAccessRuleScene } from "../../seeder/scenes/organization-access-rule.scene";
import { OrganizationCollectionScene } from "../../seeder/scenes/organization-collection.scene";
import { OrganizationLoginCipherScene } from "../../seeder/scenes/organization-login-cipher.scene";
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
  ownerOrganizationUserId: string;
  organizationId: string;
  organizationKeyB64: string;
};

export type PamMember = {
  account: Account;
  organizationUserId: string;
};

export type SeededItem = {
  cipherId: string;
  name: string;
  password: string;
};

const GATED_SHARED_FOLDER = "Production servers";
const GATED_ITEM = "Production database";
const GATED_ITEM_PASSWORD = "correct-horse-battery-staple";
const GATED_ITEM_RULE = "Production break-glass";

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
    ownerOrganizationUserId: organization.result.organizationUserId,
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

/**
 * A login in a shared folder an access rule governs. The member can read the folder and the owner
 * manages it, which makes the owner the rule's approver. Without `requireHumanApproval` the rule
 * approves every request on its own.
 */
export async function seedGatedItem(
  play: Play,
  organization: PamOrganization,
  member: PamMember,
  { requireHumanApproval }: { requireHumanApproval?: boolean } = {},
): Promise<SeededItem> {
  const { organizationId, organizationKeyB64 } = organization;
  const sharedFolder = await play.scene(
    new OrganizationCollectionScene({
      organizationId,
      organizationKeyB64,
      name: GATED_SHARED_FOLDER,
      users: [
        { id: member.organizationUserId, readOnly: true, hidePasswords: false, manage: false },
        {
          id: organization.ownerOrganizationUserId,
          readOnly: false,
          hidePasswords: false,
          manage: true,
        },
      ],
    }),
  );
  const { collectionId } = sharedFolder.result;
  const item = await play.scene(
    new OrganizationLoginCipherScene({
      userId: organization.ownerUserId,
      organizationId,
      organizationKeyB64,
      name: GATED_ITEM,
      username: "postgres",
      password: GATED_ITEM_PASSWORD,
      collectionIds: [collectionId],
    }),
  );
  await play.scene(
    new OrganizationAccessRuleScene({
      organizationId,
      name: GATED_ITEM_RULE,
      collectionIds: [collectionId],
      requireHumanApproval,
    }),
  );

  return { cipherId: item.result.cipherId, name: GATED_ITEM, password: GATED_ITEM_PASSWORD };
}
