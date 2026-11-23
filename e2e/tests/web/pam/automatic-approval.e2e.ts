import { expect } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { GatedItem } from "../../../src/web/pam/gated-item";
import { seedGatedItem, seedPamMember, seedPamOrganization } from "../../../src/web/pam/seed";

const REASON = "Rotating the replica's certificates";

test("a member requests access to a governed item, starts it, and sees its password", async ({
  page,
  play,
}) => {
  // Given a member who can read a governed item, without access to it yet
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member);
  await logInToWebVault(page, member.account);

  const item = new GatedItem(page, seeded.cipherId);
  await item.open();
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
  await expect(item.revealedPassword).toContainText(seeded.password);
});

test("a member ends their access early", async ({ page, play }) => {
  // Given a member holding a lease on a governed item
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member);
  await logInToWebVault(page, member.account);

  const item = new GatedItem(page, seeded.cipherId);
  await item.open();
  await item.requestAccess(REASON);
  await item.startAccess();
  await expect(item.passwordField).toBeVisible();

  // When the member ends it
  await item.endAccess();

  // Then the password is withheld again, and the member can request access anew
  await expect(item.requestCard).toBeVisible();
  await expect(item.passwordField).toBeHidden();
});

test("a member without a PAM license cannot request access", async ({ page, play }) => {
  // Given a member without a PAM license who can read a governed item
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization, { accessPam: false });
  const seeded = await seedGatedItem(play, organization, member);
  await logInToWebVault(page, member.account);

  // When the member opens the item
  const item = new GatedItem(page, seeded.cipherId);
  await item.open();

  // Then it explains the license is missing, and offers no request
  await expect(item.unlicensedCard).toBeVisible();
  await expect(item.requestAccessButton).toBeHidden();
  await expect(item.passwordField).toBeHidden();
});
