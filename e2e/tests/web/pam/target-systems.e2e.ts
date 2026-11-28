import { expect } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { AccessConnectorsTab, TargetSystemsTab } from "../../../src/web/pam/rotation";
import { seedPamOrganization } from "../../../src/web/pam/seed";

const TARGET_SYSTEM = "Billing database";
const CONNECTOR = "Datacenter connector";

test("an owner adds a custom script target system that ends sessions", async ({ page, play }) => {
  // Given an organization without target systems
  const { owner, organizationId } = await seedPamOrganization(play);
  await logInToWebVault(page, owner);
  const targetSystems = new TargetSystemsTab(page, organizationId);
  await targetSystems.goto();

  // When the owner adds a custom script target system whose script ends sessions
  const editPage = await targetSystems.createFromTemplate("custom-script");
  await editPage.name.fill(TARGET_SYSTEM);
  await editPage.endsSessions.check();
  await editPage.save();

  // Then it is listed, and keeps ending sessions
  await expect(targetSystems.nameButton(TARGET_SYSTEM)).toBeVisible();
  const saved = await targetSystems.open(TARGET_SYSTEM);
  await expect(saved.name).toHaveValue(TARGET_SYSTEM);
  await expect(saved.endsSessions).toBeChecked();
});

test("an owner assigns an access connector to a target system", async ({ page, play }) => {
  // Given an access connector and a target system
  const { owner, organizationId } = await seedPamOrganization(play);
  await logInToWebVault(page, owner);
  const connectors = new AccessConnectorsTab(page, organizationId);
  await connectors.goto();
  await connectors.registerAndDismissToken(CONNECTOR);
  const targetSystems = new TargetSystemsTab(page, organizationId);
  await targetSystems.addCustomScript(TARGET_SYSTEM);

  // When the owner assigns the connector to the target system
  await connectors.goto();
  await connectors.assignTargetSystem(CONNECTOR, TARGET_SYSTEM);

  // Then the target system lists the connector
  await targetSystems.goto();
  const editPage = await targetSystems.open(TARGET_SYSTEM);
  await expect(editPage.chosenConnectors).toContainText(CONNECTOR);
});
