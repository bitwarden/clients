# PAM onboarding tours

Placeholder copy for review. Source of truth for the strings is `apps/web/src/locales/en/messages.json` (keys `pamCoachmark*`); tours are defined in `libs/vault/src/components/coachmark/tours/pam-tours.ts`. Regenerate this file when either changes.

## Figma import

`onboarding-tours.mmd` is a Mermaid flowchart with the exact copy in every step node. In FigJam, use a Mermaid import (a Mermaid-to-FigJam plugin, or FigJam AI create from Mermaid) and paste the file contents. Each tour is its own group. If an importer does not render `<br/>`, replace it with a space.

## Popover chrome (every step)

- Step indicator: `$CURRENT$ of $TOTAL$` (for example "1 of 3")
- Buttons: `Back` (hidden on the first step), `Next`, and `Done` on the last step
- Closing the popover counts as completing the tour (existing engine behavior)
- No "Learn more" link yet (no help URLs)
- Start requests made while an onboarding dialog is open are held and replayed when the dialog closes (`CoachmarkService.holdStarts`)
- One tour runs at a time; a user who qualifies for several sees the rest on a later eligible visit
- All tours require the feature flag `pm-37044-pam-v-0` and completion is stored per user

## Tour 1: End-user vault tour

- **Starts when:** User opens a gated item for the first time
- **Conditions:** Feature flag pm-37044-pam-v-0 is on; Member is licensed for PAM (licensing known, not unlicensed); Request access button is rendered (user can request); Tour not already completed
- **Completion key:** `pamVaultTourCompleted`

| #   | Anchor                                                                  | Position     | Title           | Description                                                                                                                                                 |
| --- | ----------------------------------------------------------------------- | ------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Request access button on the gated item banner (`pamRequestAccess`)     | below-center | Request access  | Request access to use this item. Some items are approved instantly; others are reviewed by an approver. Once approved, you still need to start your access. |
| 2   | Access requests side-nav item (opens the side nav) (`pamMyRequestsNav`) | right-center | Access requests | Track your requests here, and start your access once a request is approved.                                                                                 |

## Welcome tour (started from the PAM welcome modal)

- **Starts when:** User chooses "Start the tour" in the PAM welcome modal (stays on the vault page; no route)
- **Conditions:** Feature flag pm-37044-pam-v-0 is on; Tour not already completed. The modal's own acknowledgement is stored under `pamWelcomeAcknowledged`.
- **Completion key:** `pamWelcomeTourCompleted`

| #   | Anchor                                                                    | Position     | Title            | Description                                                                                    |
| --- | ------------------------------------------------------------------------- | ------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Controlled access column header in the vault table (`pamPrivilegedItems`) | below-start  | Privileged items | Items marked Privileged in the Controlled access column need approval before you can use them. |
| 2   | Access requests side-nav item (opens the side nav) (`pamMyRequestsNav`)   | right-center | Access requests  | Track your requests here, and start your access once a request is approved.                    |

## Tour 2: End-user Access requests tour

- **Starts when:** User opens /pam (Access requests) for the first time
- **Conditions:** Feature flag pm-37044-pam-v-0 is on; Approval privilege known (wait for it, then wait one render); Tour not already completed
- **Completion key:** `pamAccessRequestsTourCompleted`

| #   | Anchor                                                                                                   | Position    | Title             | Description                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Approvals tab (approvers only) (`pamApprovalsTab`)                                                       | below-start | Approvals         | Review and decide on access requests assigned to you.                                                         |
| 2   | My requests tab (`pamMyRequestsTab`)                                                                     | below-start | My requests       | Your pending and active access requests appear here.                                                          |
| 3   | Status filter, or the empty state when there are no requests, on the My requests tab (`pamActiveAccess`) | below-start | Approved requests | Approved requests show up here. Start your access from the Actions column when you are ready to use the item. |
| 4   | History tab (`pamHistoryTab`)                                                                            | below-start | History           | Review your past access requests and their outcomes.                                                          |

## Tour 3: Admin tour

- **Starts when:** Admin opens the Admin Console and the Privileged Controls group first renders
- **Conditions:** PAM and Rotation feature flags both resolved; at least one PAM nav item is visible to the admin; Tour not already completed
- **Completion key:** `pamAdminTourCompleted`

| #   | Anchor                                            | Position     | Title               | Description                                                                                                |
| --- | ------------------------------------------------- | ------------ | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Privileged Controls org nav group (`pamOrgGroup`) | right-start  | Privileged controls | Manage privileged access for your organization from this section.                                          |
| 2   | Access rules nav item (`pamAccessRules`)          | right-center | Access rules        | Start here: create a rule from a template to choose which items require approval and who can approve them. |
| 3   | Audit log nav item (`pamAuditLog`)                | right-center | Audit log           | See a record of privileged access activity.                                                                |
| 4   | Rotation nav item (`pamRotation`)                 | right-center | Rotation            | Configure automatic credential rotation for privileged items.                                              |

Variants: Tour 2 for non-approvers omits Approvals (3 steps, indicator "1 of 3"); Tour 3 includes Access rules, Audit log and Rotation only when the admin can see them, and the indicator counts only shown steps. No Governance step yet.
