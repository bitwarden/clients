# Access audit — SDK follow-up

`AuditApiService` reads the access-audit trail over raw HTTP. That is the only exception left to this
module's rule that PAM calls go through the Rust SDK — the approver surface was the other one, and it
moved to the SDK in "Serve the PAM approver surface from the SDK" (#22510). This one remains only
because the pinned commercial SDK has no audit surface at all: `pam()` exposes `access_requests()`,
`access_rules()`, `leases()`, and the approver surface, and nothing else.

Closing the exception is SDK work. This note records the shape so it does not have to be re-derived.

## What the server offers

`GET /organizations/{orgId}/audit` — org-scoped, authorized by the `AccessEventLogs` permission,
returning **one page** of the trail within the shared 90-day history window, newest first, with each
action's before/after pair already collapsed to one entry server-side. A caller without the
permission gets a 404, not an empty list.

The read is bounded and filtered server-side. Query parameters: `start`, `end`, `kind` (repeated),
`actorId` (repeated), `includeAutomatedActor`, `requesterId` (repeated), `cipherId` (repeated),
`ruleId` (repeated), and `continuationToken`. Values within a dimension are OR-ed, dimensions are
AND-ed — with one exception: `cipherId` and `ruleId` union with **each other**, because they are the
two halves of one Item selection and a rule-administration event names a rule and no cipher. A range
wider than the retention window is a 400, as is an unknown `kind` or a token the endpoint did not
issue — none of the three is quietly ignored, because each would otherwise be answered with the wrong
trail rather than an error.

`GET /organizations/{orgId}/audit/items` — the distinct subjects the trail names in a range, taking
`start` and `end` only, unpaged, behind the same permission and the same kill switch. This is what
the Item filter's menu is built from, and it exists because neither obvious source works: a page of
the trail names only some of the items in range, and the caller's vault holds credentials the trail
never mentions. Each entry sets either `cipherId`/`collectionId` or `ruleId`/`ruleName`. No cipher
name is returned — the client resolves those from its own vault and drops what it cannot label, which
is what leaves a menu offering exactly the items that both occur and can be named.

The response is `ListResponseModel<AccessAuditEventResponseModel>`, whose `continuationToken` is set
while pages remain and absent on the last one; see `responses/access-audit-event.response.ts` for
the field-by-field contract this client relies on. Note `kind` is a **string** vocabulary
(`"requestApproved"`, …), not an integer enum — the server's `AccessAuditEventKindNames` maps the
domain enum onto it deliberately, so the SDK models should mirror the strings rather than
re-numbering. That same vocabulary is what the `kind` filter takes, so the SDK should expose one
enum for both directions.

## What the SDK needs

In `bitwarden_license/bitwarden-pam` (in `sdk-internal`), alongside the existing modules:

```
src/audit/
  mod.rs        // module wiring
  models.rs     // AccessAuditEventView, the kind/phase vocabularies, AuditTrailFilter
  client.rs     // AuditClient::list(organization_id, filter) -> AuditTrailPage
                //           ::list_items(organization_id, range) -> Vec<AccessAuditItemView>
src/pam_client.rs   // add .audit()
```

`list` has to be the paged, filtered shape rather than the whole trail: the endpoint no longer
serves an unbounded read, and the CSV export walks every page of it.

Two field-level details worth carrying over rather than rediscovering:

- `cipher_name` and `collection_name` on the wire are **encrypted** (EncString). This client ignores
  them and resolves names from local vault state instead, because an auditor generally cannot decrypt
  another member's items. Whatever the SDK exposes, it must not imply these are plaintext.
- `rule_name` **is** plaintext — it is organization configuration, not Vault Data, and the server
  captures it in C# rather than joining it, because a rule can be hard-deleted in the same action.

## The swap, once the SDK ships

1. Add `access-audit-sdk.service.ts` implementing the same `AuditApiService` contract via
   `commercial().pam().audit()`, following the per-call pattern in `services/access-rules-sdk.service.ts`
   (resolve the active user, take a client `Ref` from `SdkService.userClient$`, dispose with `using`).
2. Change the one `AuditApiService` provider line in `provide-pam.ts` to point at it.
3. Delete `default-audit-api.service.ts` and the two response classes under `responses/`. That removes
   the module's last HTTP call, so the SDK rule becomes unconditional.

Nothing in `access-audit.component.ts` or `access-audit-row.ts` should need to change: both speak only
to the `AuditApiService` contract — `AuditTrailFilter` in, `AuditTrailPage` out — and the row type,
neither of which is HTTP-shaped.
