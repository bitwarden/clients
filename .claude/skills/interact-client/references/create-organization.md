# Create an organization / clear a paywall

Two upgrades come up constantly in test runs. Neither is a reason to stop a run — see the
"Paywalls are not a blocker" section in the main SKILL.md.

- **Personal feature behind Premium** (attachments, TOTP, emergency access, file Sends) → buy
  Premium.
- **Organization feature** (org-owned items, collections, policies, SSO) → create an organization.

Card details where a paid tier is genuinely needed: [test-payment.md](test-payment.md).

## Pick the cheapest tier that unblocks the case

**Try Free first.** A Free organization allows **2 users including the owner** and 2 collections,
costs nothing, and skips the payment form entirely — no Stripe, no card. That is enough for the
common "one admin plus one member" fixture, and for anything exercising org-owned items or
collection sharing.

Go paid only when the case actually needs it:

| Need                                       | Tier       |
| ------------------------------------------ | ---------- |
| org-owned items, collections, 1 other user | Free       |
| more than 2 users, groups, directory sync  | Teams      |
| enterprise policies, SSO, **custom roles** | Enterprise |

The Custom member role is visibly disabled on Free and Teams with an "enterprise feature" note, so
a case about custom permissions needs Enterprise.

## Buy Premium for the current account

Route: `#/settings/subscription/premium` (`CloudHostedPremiumComponent` on a cloud server,
`SelfHostedPremiumComponent` when self-hosted). Page heading: "Upgrade for complete security".

1. Navigate to the route. Two pricing cards render, Premium and Families.
2. Click **Upgrade to Premium** on the Premium card. This opens the upgrade dialog.
3. The dialog collects an organization name only for the Families path; for Premium, go straight to
   the payment section. It embeds the same `app-enter-payment-method` card form described in
   [test-payment.md](test-payment.md).
4. Fill the card, then the billing address.
5. Click **Upgrade**.
6. Screenshot and confirm the account now shows Premium. Re-check the gated feature you originally
   hit — the upsell should be gone.

## Create an organization

Route: `#/create-organization` (`CreateOrganizationComponent`, which renders
`app-organization-plans` — all the real UI lives there).

1. Navigate to the route. You can preselect a tier via query params the component reads:
   `plan`, `productTier`, `product`, `trialLength`.
2. Pick the plan radio for the tier you need. Fields on the page:
   - **User seats** / **Additional user seats**
   - **Additional storage (GB)**
   - **Premium access**
   - annual vs. monthly billing
3. A **Payment information** section appears for any tier above Free, containing
   `app-enter-payment-method` and `app-enter-billing-address`. Fill the card per
   [test-payment.md](test-payment.md). On Free this section does not render at all.
4. Click **Submit**. Submit stays disabled until Organization name is filled; Billing email is
   prefilled with the account's address.
5. On success the client navigates to `#/organizations/<orgId>/vault`. Take the `orgId` from the
   URL — you need it for every admin-console route below.

## Add a member to the organization

Four steps, and the last one is easy to miss: **an accepted invite is not an active member.**

1. **Invite**, as the owner. Go to `#/organizations/<orgId>/members` and click **Invite member**.
   Fill Email, pick the role (**User** is the default and is the plain regular-member role), click
   **Save**. The member appears with status `Invited`.
2. **Register the invitee**, if that account does not exist yet — see
   [create-user.md](create-user.md). Log out of the owner first.
3. **Accept**, as the invitee. The invite email ("You have been invited to Bitwarden Password
   Manager") carries an `#/accept-organization?...` link; pull it from MailCatcher the same way as
   the verification link, replacing `&amp;` with `&`. Navigating it shows "Successfully accepted
   your invitation." Status becomes `Needs confirmation`.
4. **Confirm**, back as the owner. The members page shows a "Confirm members" banner. Open the
   member row's **Options** menu, click **Confirm**, and accept the fingerprint-phrase dialog.

Until step 4 the member is _not_ in the org: their vault filter still shows only "All vaults" and
"My vault", with no organization entry. If a case needs a working org member, verify the members
list shows no `Invited` and no `Needs confirmation` state before you rely on it.

## After upgrading

- Sync before asserting. The client may still be showing pre-upgrade state; navigate away and back,
  or reload, then confirm the gate is actually gone before continuing the case.
- **Record the upgrade in the run summary** — which plan, and that it happened mid-run. Account
  state is part of the environment, and it cannot be recovered from the screenshots later.
- If the upgrade itself fails, that _is_ a real block. Say what failed and capture the error, rather
  than reporting the original paywall.

## Related

- [test-payment.md](test-payment.md) — test cards and the Stripe Elements caveat
- [create-user.md](create-user.md) — register the account in the first place
