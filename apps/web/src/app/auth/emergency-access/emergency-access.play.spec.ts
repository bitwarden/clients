import { test as base, expect, Page } from "@playwright/test";

import {
  EmergencyAccessInviteRecipe,
  Play,
  Scene,
  SingleUserRecipe,
} from "@bitwarden/playwright-helpers";

async function authenticate(page: Page, email: string) {
  using scene = await Play.scene(new SingleUserRecipe({ email, premium: true }), { noDown: true });

  await page.goto("/#/login");
  await page.getByRole("textbox", { name: "Email address (required)" }).click();
  await page.getByRole("textbox", { name: "Email address (required)" }).fill(scene.mangle(email));
  await page.getByRole("textbox", { name: "Email address (required)" }).press("Enter");
  await page.getByRole("textbox", { name: "Master password (required)" }).click();
  await page
    .getByRole("textbox", { name: "Master password (required)" })
    .fill(scene.mangle("asdfasdfasdf"));
  await page.getByRole("button", { name: "Log in with master password" }).click();
  await expect(page.getByRole("button", { name: "Add it later" })).toBeVisible();
  await page.getByRole("button", { name: "Add it later" }).click();
  await expect(page.locator("bit-simple-dialog")).toContainText(
    "You can't autofill passwords without the browser extension",
  );
  await page.getByRole("link", { name: "Skip to web app" }).click();
  await expect(page.locator("app-vault")).toContainText("There are no items to list. New item");

  return scene;
}

type MyFixtures = {
  grantee: MyFixture2;
  grantor: MyFixture2;
};

type MyFixture2 = {
  page: Page;
  scene: Scene;
};

const test = base.extend<MyFixtures>({
  // Person getting access
  grantee: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const scene = await authenticate(page, "grantee@bitwarden.com");
    await use({ page, scene });
    //await context.close();
  },
  // Person giving access
  grantor: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const scene = await authenticate(page, "grantor@bitwarden.com");
    await use({ page, scene });
    //await context.close();
  },
});

base.describe("Emergency Access", () => {
  test.skip("Account takeover", async ({ grantee, grantor }) => {
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
    const recipe = new EmergencyAccessInviteRecipe({ email: granteeEmail });
    const result = (await recipe.up()) as unknown as string[]; // FIXME: Recipe does not only return mangle map.
    const inviteUrl = result[0];
    await grantee.page.goto(`/#${inviteUrl}`);

    // Confirm the invite
    await grantor.page.goto("/#");
    await grantor.page.goto("/#/settings/emergency-access");
    await expect(await grantor.page.getByRole("cell", { name: granteeEmail })).toBeVisible();
    await grantor.page.getByRole("button", { name: "Options" }).click();
    await grantor.page.getByRole("menuitem", { name: "Confirm" }).click();
    await grantor.page.getByRole("button", { name: "Confirm" }).click();

    // Request access
    await grantee.page.goto("/#/settings/emergency-access");
    await grantee.page.getByRole("button", { name: "Options" }).click();
    await grantee.page.getByRole("menuitem", { name: "Request Access" }).click();
    await grantee.page.getByRole("button", { name: "Request Access" }).click();

    // Approve access
    await grantor.page.goto("/#");
    await grantor.page.goto("/#/settings/emergency-access");
    await grantor.page.getByRole("button", { name: "Options" }).click();
    await grantor.page.getByRole("menuitem", { name: "Approve" }).click();
    await grantor.page.getByRole("button", { name: "Approve" }).click();

    // Initiate takeover
    await grantee.page.goto("/#");
    await grantee.page.goto("/#/settings/emergency-access");
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

    // TODO: Confirm the new password works by logging out and back in

    // await new Promise(() => {});
  });
});
