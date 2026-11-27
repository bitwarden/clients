import { expect } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { AccessConnectorsTab } from "../../../src/web/pam/rotation";
import { seedPamOrganization } from "../../../src/web/pam/seed";

const CONNECTOR = "Datacenter connector";

test("an owner registers an access connector, whose token is shown once", async ({
  page,
  play,
}) => {
  // Given an organization without access connectors
  const { owner, organizationId } = await seedPamOrganization(play);
  await logInToWebVault(page, owner);
  const connectors = new AccessConnectorsTab(page, organizationId);
  await connectors.goto();
  await expect(connectors.emptyStateRegisterButton).toBeVisible();

  // When the owner registers a connector
  const tokenDialog = await connectors.register(CONNECTOR);

  // Then its token is shown, and closing needs the owner to confirm they stored it
  await expect(tokenDialog.token).not.toBeEmpty();
  await expect(tokenDialog.closeButton).toBeDisabled();
  await tokenDialog.confirmStoredAndClose();

  // And the connector's page is open, and the list shows it
  await expect(page.getByRole("heading", { level: 1, name: CONNECTOR })).toBeVisible();
  await connectors.goto();
  await expect(connectors.nameButton(CONNECTOR)).toBeVisible();
});

test("an owner deactivates an access connector and activates it again", async ({ page, play }) => {
  // Given an access connector
  const { owner, organizationId } = await seedPamOrganization(play);
  await logInToWebVault(page, owner);
  const connectors = new AccessConnectorsTab(page, organizationId);
  await connectors.goto();
  await connectors.registerAndDismissToken(CONNECTOR);

  // When the owner deactivates it
  await connectors.deactivate(CONNECTOR);

  // Then it offers to activate instead
  const deactivated = await connectors.openOptions(CONNECTOR);
  await expect(deactivated.activate).toBeVisible();
  await expect(deactivated.deactivate).toBeHidden();
  await page.keyboard.press("Escape");

  // And once activated, it offers to deactivate again
  await connectors.activate(CONNECTOR);
  const activated = await connectors.openOptions(CONNECTOR);
  await expect(activated.deactivate).toBeVisible();
  await expect(activated.activate).toBeHidden();
});

test("an owner deletes an access connector", async ({ page, play }) => {
  // Given an access connector
  const { owner, organizationId } = await seedPamOrganization(play);
  await logInToWebVault(page, owner);
  const connectors = new AccessConnectorsTab(page, organizationId);
  await connectors.goto();
  await connectors.registerAndDismissToken(CONNECTOR);

  // When the owner deletes it
  await connectors.delete(CONNECTOR);

  // Then the organization has no connectors
  await expect(connectors.emptyStateRegisterButton).toBeVisible();
  await expect(connectors.nameButton(CONNECTOR)).toHaveCount(0);
});
