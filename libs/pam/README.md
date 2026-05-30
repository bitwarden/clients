# PAM

Privileged Access Management — credential leasing primitives for the web vault.

Provides typed API client wrappers, domain types, and pure helpers used by the credential-leasing surfaces (vault list indicator, request modal, approver inbox, governance dashboard).

Lands behind the `pm-37044-pam-v-0` feature flag.

## Rename completed: "leasing policy" → "access rule"

PM-37751 renamed the `LeasingPolicy*` types, request/response classes, service
methods, and routes to `AccessRule*` / `AccessRequest*`. The rename has been
propagated across `libs/pam` and `apps/web`. `pamLeasing*` i18n keys describing
the collection-side toggle (`pamLeasingTab*`, `pamLeasingEnabled*`,
`pamLeasingTurnOff*`, `pamLeasingSaved*`, `pamLeasingSaveFailed*`) are kept by
design; rule-shape editor keys moved to `pamAccessRule*`. `requestDetailModal*`
keys moved to `accessRequestDetailModal*`.


Terminology:
Access Rules - Rules attached to a collection

Privileged collection - Slang for a Collection with rules attached.

Access Request - User submitting for access

* Justification / Reason - reason provided with a request

* Duration - Requested/granted time window

* Approver - Human that approves the request

* (States: Pending, Approved or Denied Access Requests)

Lease - Approved active access

* States

* * Pending - approved but not yet active (User does not have the credential)

* * Active

* * Revoked

* * Expired

* Alternatives:

* * Access Lease

* * Access Grant

* * Access Session

* * Active access? – active is no good, since a lease have states that can be expired/historic.

End Access - User action when voluntarily ending their lease early

Extend access - User action when they want to increase the lease duration

Access log - Record of all requests and leases … “Event log”

We have a Event Log today, but we’re not sure it will support the more advanced querying we need to do. The Access Log could source data from access requests, as well as leases.
We hope that we will use the existing Event Log, but we may not be able to.
