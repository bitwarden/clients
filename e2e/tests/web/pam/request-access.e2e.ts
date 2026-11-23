import { expect } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { Play } from "../../../src/seeder/play";
import { OrganizationAccessRuleScene } from "../../../src/seeder/scenes/organization-access-rule.scene";
import { OrganizationCollectionScene } from "../../../src/seeder/scenes/organization-collection.scene";
import { OrganizationLoginCipherScene } from "../../../src/seeder/scenes/organization-login-cipher.scene";
import { GatedItem } from "../../../src/web/pam/gated-item";
import {
  PamMember,
  PamOrganization,
  seedPamMember,
  seedPamOrganization,
} from "../../../src/web/pam/seed";

const SHARED_FOLDER = "Production servers";
const ITEM = "Production database";
const PASSWORD = "correct-horse-battery-staple";
const REASON = "Rotating the replica's certificates";

/**
 * A login in a shared folder the member can read, governed by a rule with no conditions, which
 * approves every request on its own.
 */
async function seedGatedItem(play: Play, organization: PamOrganization, member: PamMember) {
  const { organizationId, organizationKeyB64 } = organization;
  const sharedFolder = await play.scene(
    new OrganizationCollectionScene({
      organizationId,
      organizationKeyB64,
      name: SHARED_FOLDER,
      users: [
        { id: member.organizationUserId, readOnly: true, hidePasswords: false, manage: false },
      ],
    }),
  );
  const { collectionId } = sharedFolder.result;
  const item = await play.scene(
    new OrganizationLoginCipherScene({
      userId: organization.ownerUserId,
      organizationId,
      organizationKeyB64,
      name: ITEM,
      username: "postgres",
      password: PASSWORD,
      collectionIds: [collectionId],
    }),
  );
  await play.scene(
    new OrganizationAccessRuleScene({
      organizationId,
      name: "Production break-glass",
      collectionIds: [collectionId],
    }),
  );

  return item.result.cipherId;
}

test("a member requests access to a governed item, starts it, and sees its password", async ({
  page,
  play,
}) => {
  // Given a member who can read a governed item, without access to it yet
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const cipherId = await seedGatedItem(play, organization, member);
  await logInToWebVault(page, member.account);

  const item = new GatedItem(page);
  await item.open(cipherId);
  await expect(item.requestCard).toBeVisible();
  await expect(item.passwordField).toBeHidden();

  // When the member requests access, which the rule approves on its own
  await item.requestAccess(REASON);

  // Then the request is approved, and starting access shows the password
  await expect(item.approvedCard).toBeVisible();
  await expect(item.passwordField).toBeHidden();
  await item.startAccess();
  await expect(item.activeLeaseCard).toBeVisible();
  await item.revealPassword();
  await expect(item.revealedPassword).toContainText(PASSWORD);
});

test("a member without a PAM license cannot request access", async ({ page, play }) => {
  // Given a member without a PAM license who can read a governed item
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization, { accessPam: false });
  const cipherId = await seedGatedItem(play, organization, member);
  await logInToWebVault(page, member.account);

  // When the member opens the item
  const item = new GatedItem(page);
  await item.open(cipherId);

  // Then it explains the license is missing, and offers no request
  await expect(item.unlicensedCard).toBeVisible();
  await expect(item.requestAccessButton).toBeHidden();
  await expect(item.passwordField).toBeHidden();
});
