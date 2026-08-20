# PAM server ask — machine-readable error codes

> **Resolved.** The server added the codes as RFC 7807 problem responses
> (bitwarden/server#8235), the SDK maps them onto typed error variants
> (bitwarden/sdk-internal `pam/error-codes`), and this repo's two sentence-matching catalogs are
> gone. Kept as the record of why the contract exists — in particular, what the three
> "reconcile, not an error" cases are and why rewording them is a breaking change.

One request to the server team, blocking client work that cannot be done anywhere else. Described
against the current `pm-37044-pam-v-0` surface.

> A companion ask — the governing rule's duration bounds on the pre-check read — shipped while this
> was being written: `defaultDurationSeconds` and `maxDurationSeconds` are now on
> `AccessPreCheckResponseModel`, the SDK carries them, and the requester's duration picker is
> narrowed to the rule's bounds. Nothing left to ask for there.

## The problem

PAM endpoints reject with `ErrorResponseModel`, which carries a human-readable `message` and no
machine-readable discriminant. Every failure a client must _act_ on differently is therefore
identified by matching the server's English sentence.

The web client now keeps **two** such catalogs, eighteen sentences in total, matched with
`String.includes()`:

- [`helpers/request-access-error.ts`](../bitwarden_license/bit-web/src/app/pam/helpers/request-access-error.ts)
  — twelve sentences from the lease-request endpoint.
- [`helpers/access-rule-error.ts`](../bitwarden_license/bit-web/src/app/pam/helpers/access-rule-error.ts)
  — six from the access-rule write endpoints.

They were written weeks apart by different people, and both carry the same note in their own words:
_"When the server grows a code, this catalog is the single place to retire."_ Two independent
authors reaching for the same workaround, and writing down the same wish, is the argument for this
ask in miniature.

Three consequences, in order of severity:

**1. Some of these are not failures at all.** `AlreadyActive`, `AlreadyApproved` and
`AlreadyPending` mean the requester already has what they asked for. The UI reconciles — collapses
the request form, re-reads the access state, shows an informational toast — rather than reporting an
error. Reword any of those three sentences and a reconciliation silently becomes a red error toast.
No test fails on either side; the contract lives only in a string literal in a client repo.

**2. The unmatched fallback is unusable.** The `Api` variant's message is the whole serialized
response body — envelope, `exceptionMessage`, and server-side stack trace. `classifyAccessRuleError`
therefore refuses to show or log it at all, because it carries the server's filesystem paths, and
falls back to generic copy. So a sentence the catalog misses is not degraded to "the server's own
words" — it degrades to "something went wrong."

**3. Every other client repeats the work.** Browser, desktop and mobile each need their own copy of
both catalogs, kept in sync by hand against a server that has never promised to keep the wording
stable.

Status codes do not disambiguate: these are all `400`.

This has already bitten an adjacent feature. The organization-invite classifier regexes the status
and JSON body out of the SDK's error string; its own comment calls the coupling _"fragile … accepted
for MVP"_, and it needed repair when the format changed (clients commit `9001fdd01a`, "Update
accept-error classifier for new SDK API error format").

## The ask

Add a stable, machine-readable `code` to the error responses from PAM endpoints, alongside the
existing `message`.

Preferred shape — extend `ErrorResponseModel` with an optional `code`, so the mechanism is available
to any endpoint rather than being PAM-specific:

```jsonc
{
  "object": "error",
  "code": "access_request_already_pending", // new: stable, never localized, never reworded
  "message": "You already have a pending request for this item.", // unchanged, display/fallback
  "validationErrors": {},
}
```

### Codes needed — access requests (`POST /access-requests`, all `400`)

| Current message                                                                    | Proposed code                     | Why the client must tell it apart             |
| ---------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- |
| `You already have active access to this item.`                                     | `access_already_active`           | **Reconcile, not an error** — re-read state   |
| `You already have an approved request for this item.`                              | `access_request_already_approved` | **Reconcile, not an error**                   |
| `You already have a pending request for this item.`                                | `access_request_already_pending`  | **Reconcile, not an error**                   |
| `A reason is required for items that need human approval.`                         | `reason_required`                 | Field-level: marks the reason control invalid |
| `This item is approved automatically; provide a duration, not a window.`           | `duration_expected`               | Inline form error                             |
| `This item requires human approval; provide a start and end date, not a duration.` | `window_expected`                 | Inline form error                             |
| `The start date must be before the end date.`                                      | `window_end_before_start`         | Inline form error                             |
| `A start and end date are required.`                                               | `window_required`                 | Inline form error                             |
| `A positive duration is required.`                                                 | `duration_must_be_positive`       | Inline form error                             |
| `The requested duration exceeds the maximum of 86400 seconds.`                     | `duration_exceeds_max`            | Inline form error                             |
| `The requested window exceeds the maximum of 86400 seconds.`                       | `window_exceeds_max`              | Inline form error                             |
| `This item does not require a lease.`                                              | `cipher_not_gated`                | Inline form error                             |

### Codes needed — access rules (`POST`/`PUT /organizations/{id}/access-rules`)

Sourced from `AccessRuleWriteValidator` and the create/update commands; each maps to correctable
copy against a named form control.

| Current message                                                        | Proposed code                  | Form control                  |
| ---------------------------------------------------------------------- | ------------------------------ | ----------------------------- |
| `Name is required.`                                                    | `rule_name_required`           | `name`                        |
| `A rule with that name already exists.`                                | `rule_name_taken`              | `name`                        |
| `A maximum extension length is required when extensions are allowed.`  | `extension_length_required`    | `maxExtensionDurationSeconds` |
| `One or more collections could not be found.`                          | `collections_missing`          | `collections`                 |
| `One or more collections do not belong to this organization.`          | `collections_foreign`          | `collections`                 |
| `One or more collections are already governed by another access rule.` | `collections_already_governed` | `collections`                 |

Names are suggestions; any stable spelling works as long as the contract below holds.

## Contract we are asking for

- A `code` is a stable identifier. It is never localized and never reworded once shipped — that is
  the entire point of adding it.
- `message` stays exactly as it is today.
- Adding codes is additive. Clients treat an unknown code as a generic failure, so new codes never
  need a client release to be safe.

## What happens downstream

The SDK maps codes onto typed error variants (`AccessRequestError::AlreadyPending`,
`AccessRuleError::CollectionsAlreadyGoverned`, …) — the same way it now maps the server's `404` onto
`AccessRuleError::NotFound` — and both client catalogs are deleted rather than copied into the next
client.
