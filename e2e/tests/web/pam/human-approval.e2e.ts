import { expect, Page } from "@playwright/test";

import { Account } from "../../../src/credentials";
import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { Play } from "../../../src/seeder/play";
import { ApprovalsPage } from "../../../src/web/pam/approvals";
import { GatedItem } from "../../../src/web/pam/gated-item";
import { seedGatedItem, seedPamMember, seedPamOrganization } from "../../../src/web/pam/seed";

const REASON = "Rotating the replica's certificates";
const DENIAL = "Use the staging replica instead";

/** A member who has asked for a governed item under a rule an approver decides, logged in. */
async function requestApproval(play: Play, page: Page) {
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member, { requireHumanApproval: true });

  await logInToWebVault(page, member.account);
  const item = new GatedItem(page, seeded.cipherId);
  await item.open();
  await item.requestAccess(REASON);
  await expect(item.pendingCard).toBeVisible();

  return { owner: organization.owner, item, seeded };
}

/** The owner's Approvals page, on a page of their own beside the member's. */
async function openApprovals(newPage: () => Promise<Page>, owner: Account) {
  const ownerPage = await newPage();
  await logInToWebVault(ownerPage, owner);
  const approvals = new ApprovalsPage(ownerPage);
  await approvals.goto();

  return approvals;
}

test("an approver approves a request, and the member starts access", async ({
  page,
  play,
  newPage,
}) => {
  // Given a member's pending request
  const { owner, item, seeded } = await requestApproval(play, page);
  await expect(item.passwordField).toBeHidden();

  // When the owner approves it
  const approvals = await openApprovals(newPage, owner);
  await approvals.approve(seeded.name);

  // Then the member can start access, and sees the password
  await item.reopen();
  await expect(item.approvedCard).toBeVisible();
  await item.startAccess();
  await expect(item.activeLeaseCard).toBeVisible();
  await item.revealPassword();
  await expect(item.revealedPassword).toContainText(seeded.password);
});

test("an approver denies a request", async ({ page, play, newPage }) => {
  // Given a member's pending request
  const { owner, item, seeded } = await requestApproval(play, page);

  // When the owner denies it, with a reason
  const approvals = await openApprovals(newPage, owner);
  await approvals.deny(seeded.name, DENIAL);

  // Then the member has no access, and can ask again
  await item.reopen();
  await expect(item.requestCard).toBeVisible();
  await expect(item.passwordField).toBeHidden();
});

test("a member withdraws a pending request", async ({ page, play }) => {
  // Given a member's pending request
  const { item } = await requestApproval(play, page);

  // When the member withdraws it
  await item.cancelRequest();

  // Then it is no longer pending, and the member can ask again
  await expect(item.pendingCard).toBeHidden();
  await expect(item.requestCard).toBeVisible();
});
