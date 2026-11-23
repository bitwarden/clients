import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { Play } from "../../../src/seeder/play";
import { OrganizationAccessRuleScene } from "../../../src/seeder/scenes/organization-access-rule.scene";
import { OrganizationCollectionScene } from "../../../src/seeder/scenes/organization-collection.scene";
import {
  PlanType,
  SingleOrganizationScene,
} from "../../../src/seeder/scenes/single-organization.scene";
import { seededAccount, SingleUserScene } from "../../../src/seeder/scenes/single-user.scene";
import { AccessRulesPage } from "../../../src/web/pam/access-rules";

const SHARED_FOLDER = "Production servers";
const RULE = "Production break-glass";

/**
 * An owner of an organization with PAM, holding one shared folder, logged in. The server must
 * have the `pm-37044-pam-v-0` flag on, since it gates the access rule endpoints.
 */
async function seedPamOwner(play: Play) {
  const user = await play.scene(
    new SingleUserScene({ email: "pam-owner@example.com", password: randomUUID() }),
  );
  const organization = await play.scene(
    new SingleOrganizationScene({
      ownerUserId: user.result.userId,
      planType: PlanType.EnterpriseAnnually,
      name: "PAM org",
      domain: "pam.example.com",
      seats: 5,
      overrides: { usePam: true },
    }),
  );
  const { organizationId, organizationKeyB64 } = organization.result;
  const sharedFolder = await play.scene(
    new OrganizationCollectionScene({ organizationId, organizationKeyB64, name: SHARED_FOLDER }),
  );

  return {
    account: seededAccount(user),
    organizationId,
    sharedFolderId: sharedFolder.result.collectionId,
  };
}

test("creates a rule governing a shared folder", async ({ page, play }) => {
  // Given an organization with a shared folder and no access rules
  const { account, organizationId } = await seedPamOwner(play);
  await logInToWebVault(page, account);

  const accessRules = new AccessRulesPage(page);
  await accessRules.goto(organizationId);
  await expect(accessRules.emptyState).toBeVisible();

  // When the owner creates a rule over the shared folder
  const editPage = await accessRules.createFromEmptyState();
  await editPage.name.fill(RULE);
  await editPage.addSharedFolder(SHARED_FOLDER);
  await editPage.save();

  // Then the list shows the rule, active, governing that folder
  await expect(accessRules.activeBadge(RULE)).toBeVisible();
  const sharedFolders = accessRules.sharedFoldersBadge(RULE);
  await sharedFolders.hover();
  await expect(sharedFolders).toHaveAccessibleDescription(SHARED_FOLDER);
});

test("renames a rule and describes it", async ({ page, play }) => {
  // Given a rule over the shared folder
  const { account, organizationId, sharedFolderId } = await seedPamOwner(play);
  await play.scene(
    new OrganizationAccessRuleScene({
      organizationId,
      name: RULE,
      collectionIds: [sharedFolderId],
    }),
  );
  await logInToWebVault(page, account);

  const accessRules = new AccessRulesPage(page);
  await accessRules.goto(organizationId);

  // When the owner renames it and adds a description
  const renamed = "Production on-call";
  const description = "Granted to whoever holds the pager.";
  const editPage = await accessRules.openRule(RULE);
  await expect(editPage.name).toHaveValue(RULE);
  await editPage.name.fill(renamed);
  await editPage.description.fill(description);
  await editPage.save();

  // Then the list shows it under the new name only, and the rule kept the description
  await expect(accessRules.row(renamed)).toBeVisible();
  await expect(accessRules.row(RULE)).toHaveCount(0);
  await expect(accessRules.row(renamed)).toContainText(description);
});

test("deactivates a rule once confirmed", async ({ page, play }) => {
  // Given an active rule over the shared folder
  const { account, organizationId, sharedFolderId } = await seedPamOwner(play);
  await play.scene(
    new OrganizationAccessRuleScene({
      organizationId,
      name: RULE,
      collectionIds: [sharedFolderId],
    }),
  );
  await logInToWebVault(page, account);

  const accessRules = new AccessRulesPage(page);
  await accessRules.goto(organizationId);
  await expect(accessRules.activeBadge(RULE)).toBeVisible();

  // When the owner deactivates it and confirms
  await accessRules.deactivate(RULE);

  // Then the rule shows as inactive
  await expect(accessRules.inactiveBadge(RULE)).toBeVisible();
  await expect(accessRules.activeBadge(RULE)).toHaveCount(0);
});

test("deletes a rule once confirmed", async ({ page, play }) => {
  // Given the organization's only rule
  const { account, organizationId, sharedFolderId } = await seedPamOwner(play);
  await play.scene(
    new OrganizationAccessRuleScene({
      organizationId,
      name: RULE,
      collectionIds: [sharedFolderId],
    }),
  );
  await logInToWebVault(page, account);

  const accessRules = new AccessRulesPage(page);
  await accessRules.goto(organizationId);
  await expect(accessRules.row(RULE)).toBeVisible();

  // When the owner deletes it and confirms
  await accessRules.delete(RULE);

  // Then the list is back to its empty state
  await expect(accessRules.emptyState).toBeVisible();
});
