import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { clientAccounts } from "../../../src/accounts";
import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { seededAccount, SingleUserScene } from "../../../src/seeder/scenes/single-user.scene";

const VAULT_URL = /#\/vault/;

test("logs into the vault as a user seeded for the test", async ({ page, play }) => {
  // Given a user who exists only for this test
  const user = await play.scene(
    new SingleUserScene({ email: "seeded-user@example.com", password: randomUUID() }),
  );

  const account = seededAccount(user);

  // When the user logs in with their master password
  await logInToWebVault(page, account);

  // Then the user should land on their own vault
  await expect(page).toHaveURL(VAULT_URL);
  await expect
    .poll(() => clientAccounts(page))
    .toContainEqual(expect.objectContaining({ email: account.email, status: "Unlocked" }));
});
