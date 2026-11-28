import { expect, Page } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { Play } from "../../../src/seeder/play";
import { OrganizationCollectionScene } from "../../../src/seeder/scenes/organization-collection.scene";
import { OrganizationLoginCipherScene } from "../../../src/seeder/scenes/organization-login-cipher.scene";
import { PamRotationJobScene } from "../../../src/seeder/scenes/pam-rotation-job.scene";
import { ManagedCredentialsTab, TargetSystemsTab } from "../../../src/web/pam/rotation";
import { seedPamOrganization } from "../../../src/web/pam/seed";

const SHARED_FOLDER = "Production servers";
const ITEM = "Billing database admin";
const TARGET_SYSTEM = "Billing database";
const ACCOUNT = "billing-admin";

/** The owner of an organization with PAM and a login in a shared folder, logged in. */
async function seedOwnerWithItem(play: Play, page: Page) {
  const organization = await seedPamOrganization(play);
  const { organizationId, organizationKeyB64 } = organization;
  const sharedFolder = await play.scene(
    new OrganizationCollectionScene({
      organizationId,
      organizationKeyB64,
      name: SHARED_FOLDER,
      users: [
        {
          id: organization.ownerOrganizationUserId,
          readOnly: false,
          hidePasswords: false,
          manage: true,
        },
      ],
    }),
  );
  await play.scene(
    new OrganizationLoginCipherScene({
      userId: organization.ownerUserId,
      organizationId,
      organizationKeyB64,
      name: ITEM,
      username: ACCOUNT,
      password: "correct-horse-battery-staple",
      collectionIds: [sharedFolder.result.collectionId],
    }),
  );
  await logInToWebVault(page, organization.owner);

  return organizationId;
}

/** Puts the seeded login under rotation on a new custom script target system. */
async function manageItem(page: Page, organizationId: string) {
  await new TargetSystemsTab(page, organizationId).addCustomScript(TARGET_SYSTEM);
  const credentials = new ManagedCredentialsTab(page, organizationId);
  await credentials.goto();
  const form = await credentials.add();
  await form.selectVaultItem(ITEM);
  await form.selectTargetSystem(TARGET_SYSTEM);
  await form.account.fill(ACCOUNT);
  await form.save();

  return credentials;
}

test("an owner puts a vault item's credential under rotation", async ({ page, play }) => {
  // Given a login and a target system its account lives on
  const organizationId = await seedOwnerWithItem(play, page);

  // When the owner puts the login under rotation on the target system
  const credentials = await manageItem(page, organizationId);

  // Then it is listed, and its page names the item and the target system
  await expect(credentials.nameButton(ITEM)).toBeVisible();
  const credential = await credentials.open(ITEM);
  await expect(credential.vaultItem).toContainText(ITEM);
  await expect(credential.targetSystem).toContainText(TARGET_SYSTEM);

  // And with no access connector connected, it cannot rotate now
  await credential.openOptions();
  await expect(credential.rotateNowLocked).toBeVisible();
});

test("an owner pauses a credential's rotation and resumes it", async ({ page, play }) => {
  // Given a managed credential
  const organizationId = await seedOwnerWithItem(play, page);
  const credentials = await manageItem(page, organizationId);

  // When the owner pauses its rotation
  await credentials.pause(ITEM);

  // Then it offers to resume instead
  const paused = await credentials.openOptions(ITEM);
  await expect(paused.resume).toBeVisible();
  await expect(paused.pause).toBeHidden();
  await page.keyboard.press("Escape");

  // And once resumed, it offers to pause again
  await credentials.resume(ITEM);
  const resumed = await credentials.openOptions(ITEM);
  await expect(resumed.pause).toBeVisible();
  await expect(resumed.resume).toBeHidden();
});

test("a running rotation shows in the credential's history, and locks removing it", async ({
  page,
  play,
}) => {
  // Given a managed credential with a rotation waiting for a connector
  const organizationId = await seedOwnerWithItem(play, page);
  const credentials = await manageItem(page, organizationId);
  const rotationConfigId = await credentials.credentialId(ITEM);
  await play.scene(new PamRotationJobScene({ rotationConfigId }));

  // When the owner opens the credential
  const credential = await credentials.open(ITEM);

  // Then it cannot be removed from rotation
  await credential.openOptions();
  await expect(credential.removeLocked).toBeVisible();
  await page.keyboard.press("Escape");

  // And its history lists the rotation
  await credential.goto("history");
  await expect(credential.historyJobs).toHaveCount(1);
});
