import { expect } from "@playwright/test";

import {
  test,
  EmergencyAccessInviteQuery,
  Play,
  expectUnlockedAs,
} from "@bitwarden/playwright-helpers";

test.describe("Emergency Access", () => {
  test("Account takeover", async ({ auth }) => {
    const grantee = await auth.authenticate("grantee@bitwarden.com", "asdfasdfasdf", {
      premium: false,
    });
    const grantor = await auth.authenticate("grantor@bitwarden.com", "asdfasdfasdf", {
      premium: true,
    });

    const granteeEmail = grantee.scene.mangle("grantee@bitwarden.com");

    // Add a new emergency contact
    await grantor.page.goto("/#/settings/emergency-access");
    await grantor.page.getByRole("button", { name: "Add emergency contact" }).click();
    await expect(grantor.page.getByText("Invite emergency contact")).toBeVisible();
    await grantor.page.getByRole("textbox", { name: "Email (required)" }).fill(granteeEmail);
    await grantor.page.getByRole("radio", { name: "Takeover" }).check();
    await grantor.page.getByRole("button", { name: "Save" }).click();

    await expect(await grantor.page.getByRole("cell", { name: granteeEmail })).toBeVisible();

    // Grab the invite link from the server directly since intercepting email is hard
    const result = await Play.query(new EmergencyAccessInviteQuery({ email: granteeEmail }));
    const inviteUrl = result[0];
    await grantee.page.goto(`/#${inviteUrl}`);

    // Confirm the invite
    await grantor.page.goto("/#/settings/emergency-access");
    await grantor.page.reload();
    await expect(await grantor.page.getByRole("cell", { name: granteeEmail })).toBeVisible();
    await grantor.page.getByRole("button", { name: "Options" }).click();
    await grantor.page.getByRole("menuitem", { name: "Confirm" }).click();
    await grantor.page.getByRole("button", { name: "Confirm" }).click();

    // Request access
    await grantee.page.goto("/#/settings/emergency-access");
    await grantee.page.reload();
    await grantee.page.getByRole("button", { name: "Options" }).click();
    await grantee.page.getByRole("menuitem", { name: "Request Access" }).click();
    await grantee.page.getByRole("button", { name: "Request Access" }).click();

    // Approve access
    await grantor.page.goto("/#/settings/emergency-access");
    await grantor.page.reload();
    await grantor.page.getByRole("button", { name: "Options" }).click();
    await grantor.page.getByRole("menuitem", { name: "Approve" }).click();
    await grantor.page.getByRole("button", { name: "Approve" }).click();

    // Initiate takeover
    await grantee.page.goto("/#/settings/emergency-access");
    await grantee.page.reload();
    await grantee.page.getByRole("button", { name: "Options" }).click();
    await grantee.page.getByRole("menuitem", { name: "Takeover" }).click();

    await grantee.page
      .getByRole("textbox", { name: "New master password (required)", exact: true })
      .fill("qwertyqwerty");
    await grantee.page
      .getByRole("textbox", { name: "Confirm new master password" })
      .fill("qwertyqwerty");
    await grantee.page.getByRole("button", { name: "Save" }).click();
    await grantee.page.getByRole("button", { name: "Yes" }).click();

    // Confirm with
    const { page: newGranteePage } = await auth.authenticateForScene(grantee.scene, "qwertyqwerty");
    await expectUnlockedAs(granteeEmail, newGranteePage);
  });
});
