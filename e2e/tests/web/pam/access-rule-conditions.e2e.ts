import { expect } from "@playwright/test";

import { logInToWebVault } from "../../../src/login";
import { test } from "../../../src/seeder/fixtures";
import { GatedItem } from "../../../src/web/pam/gated-item";
import { seedGatedItem, seedPamMember, seedPamOrganization } from "../../../src/web/pam/seed";

const REASON = "Rotating the replica's certificates";
const EXTENSION_REASON = "The certificate rollout is taking longer than planned";

/** TEST-NET-1, reserved for documentation, so no client ever calls from it. */
const DOCUMENTATION_RANGE = "192.0.2.0/24";
/**
 * Loopback in each form the local API may read it in, since the dev server proxies the client's
 * calls to it: IPv4, IPv6, and IPv4 mapped into IPv6.
 */
const LOOPBACK_RANGES = ["127.0.0.0/8", "::1/128", "::ffff:127.0.0.0/104"];

test("a second member cannot start access while another member holds the one lease a rule allows", async ({
  page,
  play,
  newPage,
}) => {
  // Given a rule allowing one lease at a time, and a member holding it
  const organization = await seedPamOrganization(play);
  const first = await seedPamMember(play, organization, { email: "pam-first@example.com" });
  const second = await seedPamMember(play, organization, { email: "pam-second@example.com" });
  const seeded = await seedGatedItem(play, organization, first, {
    singleActiveLease: true,
    otherMembers: [second],
  });

  await logInToWebVault(page, first.account);
  const firstItem = new GatedItem(page, seeded.cipherId);
  await firstItem.open();
  await firstItem.requestAccess(REASON);
  await firstItem.startAccess();
  await expect(firstItem.passwordField).toBeVisible();

  // When a second member, whose request the rule approves too, starts access
  const secondPage = await newPage();
  await logInToWebVault(secondPage, second.account);
  const secondItem = new GatedItem(secondPage, seeded.cipherId);
  await secondItem.open();
  await secondItem.requestAccess(REASON);
  await expect(secondItem.approvedCard).toBeVisible();
  const refused = await secondItem.startAccess();

  // Then the start is refused, and the request stays approved
  expect(refused.ok()).toBe(false);
  await expect(secondItem.approvedCard).toBeVisible();
  await expect(secondItem.passwordField).toBeHidden();

  // And once the first member ends their lease, the second member can start theirs
  await firstItem.endAccess();
  await secondItem.startAccess();
  await expect(secondItem.activeLeaseCard).toBeVisible();
  await expect(secondItem.passwordField).toBeVisible();
});

test("a member outside a rule's IP allowlist cannot request access", async ({ page, play }) => {
  // Given a rule that allows requests only from an address range the member is outside
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member, {
    ipAllowlistCidrs: [DOCUMENTATION_RANGE],
  });
  await logInToWebVault(page, member.account);

  // When the member opens the item
  const item = new GatedItem(page, seeded.cipherId);
  await item.open();

  // Then access is unavailable, and no request is offered
  await expect(item.unavailableCard).toBeVisible();
  await expect(item.requestAccessButton).toBeHidden();
  await expect(item.passwordField).toBeHidden();
});

test("a member inside a rule's IP allowlist requests and starts access", async ({ page, play }) => {
  // Given a rule that allows requests from the member's address
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member, {
    ipAllowlistCidrs: LOOPBACK_RANGES,
  });
  await logInToWebVault(page, member.account);

  const item = new GatedItem(page, seeded.cipherId);
  await item.open();
  await expect(item.requestCard).toBeVisible();

  // When the member requests access and starts it
  await item.requestAccess(REASON);
  await expect(item.approvedCard).toBeVisible();
  await item.startAccess();

  // Then the member sees the password
  await expect(item.activeLeaseCard).toBeVisible();
  await expect(item.passwordField).toBeVisible();
});

test("a member extends their running access", async ({ page, play }) => {
  // Given a member holding a lease under a rule that allows extensions
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member, {
    allowsExtensions: true,
    maxExtensionDurationSeconds: 60 * 60,
  });
  await logInToWebVault(page, member.account);

  const item = new GatedItem(page, seeded.cipherId);
  await item.open();
  await item.requestAccess(REASON);
  await item.startAccess();
  await expect(item.leaseEndsAt).toBeVisible();
  const endsAt = await item.leaseEndsAt.textContent();

  // When the member extends it
  await item.extendAccess(EXTENSION_REASON);

  // Then the lease ends later
  await expect(item.leaseEndsAt).not.toHaveText(endsAt!);
  await expect(item.passwordField).toBeVisible();
});

test("a member cannot extend access under a rule without extensions", async ({ page, play }) => {
  // Given a rule that does not allow extensions
  const organization = await seedPamOrganization(play);
  const member = await seedPamMember(play, organization);
  const seeded = await seedGatedItem(play, organization, member, { allowsExtensions: false });
  await logInToWebVault(page, member.account);

  // When the member starts access
  const item = new GatedItem(page, seeded.cipherId);
  await item.open();
  await item.requestAccess(REASON);
  await item.startAccess();

  // Then the lease offers no extension
  await expect(item.leaseEndsAt).toBeVisible();
  await expect(item.extendAccessButton).toBeHidden();
});
