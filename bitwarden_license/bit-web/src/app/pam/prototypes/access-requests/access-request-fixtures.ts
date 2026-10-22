import { CipherType } from "@bitwarden/common/vault/enums";

import { AccessApproverLike, AccessRequestDetailView } from "./access-request.model";

/**
 * Fixture data for the Access Request prototype — a cast of requesters and a
 * list of vault items that each story / page story draws from. Keeping these in
 * one place means a tweak to Marcus's email or to Klarna's icon only has to land
 * here, and every tab, dialog, and toast picks it up.
 *
 * Mirrors the Access Requests list design: requesters are shown as login handles
 * (`marcus.chen`) on top of their full email, items match the list rows (Klarna /
 * Github / Corporate Amex / Salesforce / Shopify), and lifecycle states cover every
 * badge the list can render.
 */

export const MARCUS = { name: "marcus.chen", email: "m.chen@redwood.com" };
export const PRIYA = { name: "priya.nair", email: "p.nair@redwood.com" };
export const DEVON = { name: "devon.ortiz", email: "d.ortiz@redwood.com" };
export const SAM = { name: "sam.okafor", email: "s.okafor@redwood.com" };
export const DEREK = { name: "derek.finnegan", email: "derek.finnegan@acme.com" };

export const APPROVERS: AccessApproverLike[] = [DEREK, PRIYA];

/* ----------------------------- Approvals tab fixtures ----------------------------- */

/** Pending — Github, the example design the approver sees. */
export const githubPending: AccessRequestDetailView = {
  id: "req-github",
  itemName: "Github",
  cipherType: CipherType.Login,
  uri: "https://github.com",
  organization: "Meridian Group",
  folder: "Source control",
  requester: MARCUS,
  status: "pending",
  reason:
    "Emergency incident: the production deploy pipeline for the payments service is failing and needs an owner to push a hotfix before the next release window. Customers are seeing failed checkouts and the on-call engineer does not have access to the repository settings needed to roll back.",
  submittedAt: "Sep 30, 2026, 8:31:01 PM",
  leaseNotBefore: "Sep 30, 2026, 8:35 PM",
  leaseNotAfter: "Oct 1, 2026, 4:35 AM",
  accessRequested: "1 hour, Sep 30, until 8:07 PM",
  decisions: [],
  approvers: APPROVERS,
};

/** Pending — Klarna, a 4-hour tomorrow window from the Approvals list. */
export const klarnaPending: AccessRequestDetailView = {
  id: "req-klarna",
  itemName: "Klarna",
  cipherType: CipherType.Login,
  uri: "https://klarna.com",
  organization: "Meridian Group",
  folder: "Finance",
  requester: MARCUS,
  status: "pending",
  reason:
    "Reconciling the Q3 payment anomaly flagged in FIN-2217. Need the admin account to pull a 24-hour transaction export. A longer reason that gets truncated in the row.",
  submittedAt: "Oct 20, 2026, 4:48 PM",
  leaseNotBefore: "Oct 21, 2026, 9:00 AM",
  leaseNotAfter: "Oct 21, 2026, 1:00 PM",
  accessRequested: "4 hours, Oct 21, 9 AM to 1 PM",
  decisions: [],
  approvers: APPROVERS,
};

/** Live lease nearing expiry — Corporate Amex, 4 minutes left. */
export const amexEndingSoon: AccessRequestDetailView = {
  id: "req-amex",
  itemName: "Corporate Amex",
  cipherType: CipherType.Card,
  cardBrand: "Amex",
  organization: "Meridian Group",
  folder: "Finance",
  requester: MARCUS,
  status: "endingSoon",
  reason: "Booking the SRE conference travel. Needs the corporate card on file. Auditing.",
  submittedAt: "Oct 21, 2026, 5:08 PM",
  resolvedAt: "Oct 21, 2026, 5:10 PM",
  leaseNotBefore: "Oct 21, 2026, 5:11 PM",
  leaseNotAfter: "Oct 21, 2026, 7:11 PM",
  accessRequested: "2 hours, Oct 21, 5:11 PM to 7:11 PM",
  leaseRemaining: "4m",
  decisions: [
    {
      decider: DEREK,
      verdict: "approve",
      comment: "Approved for the SRE conference booking only.",
      decidedAt: "Oct 21, 2026, 5:10 PM",
    },
  ],
};

/** Live lease well into a 3-day window — Salesforce admin. */
export const salesforceActive: AccessRequestDetailView = {
  id: "req-salesforce",
  itemName: "Salesforce admin",
  cipherType: CipherType.Login,
  uri: "https://salesforce.com",
  organization: "Meridian Group",
  folder: "Sales Ops",
  requester: PRIYA,
  status: "active",
  reason:
    "Clean-up migration for the dedup rules. Running in a scheduled maintenance window. I need to audit.",
  submittedAt: "Sept 30, 2026, 3:50 PM",
  resolvedAt: "Sept 30, 2026, 4:04 PM",
  leaseNotBefore: "Sept 30, 2026, 4:12 PM",
  leaseNotAfter: "Oct 3, 2026, 4:12 PM",
  accessRequested: "3 days, Sept 30, 4:12 PM to Oct 3, 4:12 PM",
  leaseRemaining: "2d",
  decisions: [
    {
      decider: DEREK,
      verdict: "approve",
      comment: "Approved for the dedup migration. Logged in CHG-7781.",
      decidedAt: "Sept 30, 2026, 4:04 PM",
    },
  ],
};

/** Automatically approved, requester hasn't opened it yet — Shopify. */
export const shopifyReadyToUse: AccessRequestDetailView = {
  id: "req-shopify",
  itemName: "Shopify",
  cipherType: CipherType.Login,
  uri: "https://shopify.com",
  organization: "Meridian Group",
  folder: "E-commerce",
  requester: DEVON,
  status: "readyToUse",
  reason: "Updating the shipping-rate rules ahead of the Thursday catalog push. Auditing changes.",
  submittedAt: "Oct 21, 2026, 3:58 PM",
  resolvedAt: "Oct 21, 2026, 4:02 PM",
  leaseNotBefore: "Oct 21, 2026, 4:12 PM",
  leaseNotAfter: "Oct 21, 2026, 8:12 PM",
  accessRequested: "4 hours, Oct 21, 4:12 PM to 8:12 PM",
  awaitingActivation: true,
  decisions: [
    {
      decider: "automatic",
      verdict: "approve",
      decidedAt: "Oct 21, 2026, 4:02 PM",
    },
  ],
};

export const deniedRequest: AccessRequestDetailView = {
  ...klarnaPending,
  id: "req-denied",
  status: "denied",
  resolvedAt: "Oct 20, 2026, 5:02 PM",
  resolvedBy: DEREK,
  decisions: [
    {
      decider: DEREK,
      verdict: "deny",
      comment: "Please route through the standard FinOps runbook. No admin needed.",
      decidedAt: "Oct 20, 2026, 5:02 PM",
    },
  ],
};

export const expiredRequest: AccessRequestDetailView = {
  ...githubPending,
  id: "req-expired",
  status: "expired",
  resolvedAt: "Oct 1, 2026, 4:35 AM",
  resolvedBy: "automatic",
  decisions: [],
};

/** Default approvals tab list — mix of states that match the Approvals screenshot. */
export const approvalsRequests: AccessRequestDetailView[] = [
  klarnaPending,
  githubPending,
  amexEndingSoon,
  salesforceActive,
  shopifyReadyToUse,
];

/* ----------------------------- My requests tab fixtures ----------------------------- */

/** My own Snowflake request — ready to activate. */
export const snowflakeReadyToUse: AccessRequestDetailView = {
  id: "req-snowflake",
  itemName: "Snowflake prod",
  cipherType: CipherType.Login,
  uri: "https://snowflake.com",
  organization: "Meridian Group",
  folder: "Data",
  requester: DEREK,
  status: "readyToUse",
  reason: "Running the quarterly data audit. Need read-only prod access.",
  submittedAt: "Oct 21, 2026, 3:58 PM",
  resolvedAt: "Oct 21, 2026, 4:02 PM",
  leaseNotBefore: "Oct 21, 2026, 4:12 PM",
  leaseNotAfter: "Oct 21, 2026, 8:12 PM",
  accessRequested: "4 hours, Oct 21, 4:12 PM to 8:12 PM",
  awaitingActivation: true,
  decisions: [
    {
      decider: PRIYA,
      verdict: "approve",
      decidedAt: "Oct 21, 2026, 4:02 PM",
    },
  ],
};

/** Default my-requests list, derek.finnegan as the requester POV. */
export const myRequests: AccessRequestDetailView[] = [
  { ...amexEndingSoon, requester: DEREK, folder: "Finance" },
  { ...salesforceActive, requester: DEREK, folder: "Operations" },
  snowflakeReadyToUse,
  { ...klarnaPending, requester: DEREK, folder: "Finance" },
  { ...githubPending, requester: DEREK, folder: "Source control" },
];

/* ----------------------------- History tab fixtures ----------------------------- */

/** Natural lease completion — the happy-path terminal state. */
export const datadogSessionEnded: AccessRequestDetailView = {
  id: "hist-datadog",
  itemName: "Datadog org owner",
  cipherType: CipherType.Login,
  uri: "https://datadoghq.com",
  organization: "Meridian Group",
  folder: "Engineering",
  requester: DEVON,
  status: "sessionEnded",
  submittedAt: "Oct 21, 2026, 4:12 PM",
  resolvedAt: "Just now",
  resolvedBy: "automatic",
  leaseNotBefore: "Oct 21, 2026, 4:12 PM",
  leaseNotAfter: "Oct 21, 2026, 8:12 PM",
  accessRequested: "4 hours, Oct 21, 4:12 PM to 8:12 PM",
  decisions: [{ decider: DEREK, verdict: "approve", decidedAt: "Oct 21, 2026, 4:08 PM" }],
};

/** Denied by a human approver — terminal with a captured reason. */
export const stripeDenied: AccessRequestDetailView = {
  id: "hist-stripe",
  itemName: "Stripe dashboard",
  cipherType: CipherType.Login,
  uri: "https://stripe.com",
  organization: "Meridian Group",
  folder: "Finance",
  requester: MARCUS,
  status: "denied",
  submittedAt: "Oct 21, 2026, 2:00 PM",
  resolvedAt: "1hr ago",
  resolvedBy: DEREK,
  leaseNotBefore: "Oct 21, 2026, 2:00 PM",
  leaseNotAfter: "Oct 21, 2026, 6:00 PM",
  accessRequested: "4 hours, Oct 21, 2:00 PM to 6:00 PM",
  decisions: [
    {
      decider: DEREK,
      verdict: "deny",
      comment: "Not needed. Pulled from the dashboard runbook instead.",
      decidedAt: "Oct 21, 2026, 2:12 PM",
    },
  ],
};

/** Approver cut a live lease short — distinct from a natural session end. */
export const oktaRevoked: AccessRequestDetailView = {
  id: "hist-okta",
  itemName: "Okta admin",
  cipherType: CipherType.Login,
  uri: "https://okta.com",
  organization: "Meridian Group",
  folder: "Operations",
  requester: PRIYA,
  status: "revoked",
  submittedAt: "Oct 21, 2026, 10:00 AM",
  resolvedAt: "3hr ago",
  resolvedBy: DEREK,
  leaseNotBefore: "Oct 21, 2026, 10:00 AM",
  leaseNotAfter: "Oct 21, 2026, 6:00 PM",
  accessRequested: "8 hours, Oct 21, 10:00 AM to 6:00 PM",
  decisions: [
    {
      decider: DEREK,
      verdict: "approve",
      comment: "Approval withdrawn after the lease started. Scope changed mid-session.",
      decidedAt: "Oct 21, 2026, 10:04 AM",
    },
  ],
};

/** Requester pulled their own pending request — no decision was ever recorded. */
export const figmaCanceled: AccessRequestDetailView = {
  id: "hist-figma",
  itemName: "Figma org",
  cipherType: CipherType.Login,
  uri: "https://figma.com",
  organization: "Meridian Group",
  folder: "Design",
  requester: MARCUS,
  status: "canceled",
  submittedAt: "Oct 20, 2026, 11:00 AM",
  resolvedAt: "1d ago",
  resolvedBy: MARCUS,
  leaseNotBefore: "Oct 20, 2026, 11:00 AM",
  leaseNotAfter: "Oct 20, 2026, 3:00 PM",
  accessRequested: "4 hours, Oct 20, 11:00 AM to 3:00 PM",
  decisions: [],
};

/** Approval window passed with no decision — no lease ever issued. */
export const pagerdutyExpired: AccessRequestDetailView = {
  id: "hist-pagerduty",
  itemName: "PagerDuty",
  cipherType: CipherType.Login,
  uri: "https://pagerduty.com",
  organization: "Meridian Group",
  folder: "Engineering",
  requester: DEVON,
  status: "expired",
  submittedAt: "Oct 19, 2026, 2:00 PM",
  resolvedAt: "2d ago",
  resolvedBy: "automatic",
  leaseNotBefore: "Oct 19, 2026, 2:00 PM",
  leaseNotAfter: "Oct 19, 2026, 6:00 PM",
  accessRequested: "4 hours, Oct 19, 2:00 PM to 6:00 PM",
  decisions: [],
};

/** Prior-year completion — exercises the year-in-date rendering. */
export const servicenowSessionEnded: AccessRequestDetailView = {
  id: "hist-servicenow",
  itemName: "Service Now",
  cipherType: CipherType.Login,
  uri: "https://servicenow.com",
  organization: "Meridian Group",
  folder: "Engineering",
  requester: SAM,
  status: "sessionEnded",
  submittedAt: "Oct 14, 2025, 9:00 AM",
  resolvedAt: "Oct 14, 2025",
  resolvedBy: SAM,
  leaseNotBefore: "Oct 14, 2025, 9:00 AM",
  leaseNotAfter: "Oct 14, 2025, 1:00 PM",
  accessRequested: "4 hours, Oct 14, 2025, 9:00 AM to 1:00 PM",
  decisions: [{ decider: DEREK, verdict: "approve", decidedAt: "Oct 14, 2025, 9:03 AM" }],
};

export const historyRequests: AccessRequestDetailView[] = [
  datadogSessionEnded,
  stripeDenied,
  oktaRevoked,
  figmaCanceled,
  pagerdutyExpired,
  servicenowSessionEnded,
];
