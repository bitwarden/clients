# PAM Credential Leasing — Email Templates (PM-37279)

> Specification for the **five lifecycle emails** that the Credential Leasing feature must send.
> Owned by the server team; this document is the frontend team's hand-off.

---

## 1. Why this lives outside the clients repo

The Bitwarden clients monorepo does not contain transactional email templates. Customer-facing
mail (welcome, invite, two-step-login, etc.) is rendered server-side from templates that live in
the `bitwarden/server` repository (typically `src/Core/MailTemplates/Handlebars/*.html.hbs` and
the matching `.text.hbs` variants), assembled by a Handlebars-based `MailService`, and dispatched
by `Bit.Core.Services.HandlebarsMailService`.

**Action for the server team:** add the five templates described in
[Section 3](#3-template-specifications) under the appropriate `MailTemplates/Handlebars/Pam/`
folder, register them with the mail service, and surface a typed `IMailService` method per
template so the leasing domain can fire them on the relevant state transitions.

**This frontend ticket (PM-37279) is therefore a server-side ownership hand-off.** The clients
repo is only responsible for:

- The deep-link routes those emails point at (delivered separately under the leasing UI tickets).
- The i18n keys used to localize body content (the clients repo ships `messages.json`; server
  emails resolve from those keys via `I18nService` at send-time).

---

## 2. Cross-cutting requirements

### 2.1 Security & data classification

Per Bitwarden's [Core Vocabulary](https://contributing.bitwarden.com/architecture/security/definitions),
the following hold for every template below:

- **Cipher name** is metadata, not Vault Data — safe to include in plaintext email bodies.
- **Cipher passwords, notes, custom fields, TOTP seeds, attachments, and any other Vault Data MUST NEVER appear in an email.** Templates must not interpolate those fields under any circumstance.
- **Collection name** is metadata — safe to include.
- **Requester / approver names** are user-profile metadata — safe to include.
- **Reason / denial comment** strings are user-supplied free text. Treat them as untrusted: HTML-escape on render (Handlebars `{{ }}` default is escaped; do not switch to `{{{ }}}`).
- **Deep links MUST be absolute HTTPS URLs** generated server-side from the configured `GlobalSettings.BaseServiceUri.Vault` (or equivalent), never client-relative paths.
- Subject lines may include cipher and collection names but MUST NOT include any reason / denial-comment text (those are body-only).

### 2.2 Localization

All user-visible strings (subjects + bodies) must resolve via existing i18n keys. New keys added
for this ticket are prefixed `pamLease...` and listed alongside each template.

Frontend will ship the English `messages.json` entries in a follow-up clients PR; until then,
server keys may use the English copy below as the fallback.

### 2.3 Both variants required

Each template ships **both** an HTML variant (rich layout, Bitwarden chrome) and a plain-text
variant (no markup, line-wrapped at 78 cols). Mail clients that reject HTML must still get a
useful message.

### 2.4 Deep-link routes

All deep links point at the web vault. Source of truth for the routes is the leasing UI ticket
set; the routes referenced here are:

| Purpose                                           | Route                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Review a pending request (approver-facing)        | `/#/leasing/requests/{requestId}`                                         |
| Open the cipher (requester-facing, post-approval) | `/#/vault?cipherId={cipherId}`                                            |
| My Requests list (requester-facing)               | `/#/leasing/my-requests`                                                  |
| Request a lease extension                         | `/#/leasing/requests/new?cipherId={cipherId}&extendFromLeaseId={leaseId}` |

The server constructs each absolute URL from `globalSettings.baseServiceUri.vault` +
the route fragment.

---

## 3. Template specifications

For each template:

- **Trigger:** the domain event that fires it.
- **Recipient:** which user receives it.
- **Subject:** subject-line copy (plus i18n key).
- **Model:** strongly-typed view model the template binds against.
- **HTML body:** the rendered content (Handlebars-style placeholders).
- **Plain-text body:** the matching plaintext variant.
- **i18n keys:** new clients-repo keys this template requires.

---

### 3.1 `lease_pending_approval_email`

**Trigger.** A new `LeaseRequest` is created and policy routes it to a human approver.

**Recipient.** Each approver eligible to action the request (one email per approver).

**Subject.**

```
Access request: {{cipherName}} ({{collectionName}})
```

i18n key: `pamLeasePendingApprovalSubject` → `"Access request: $CIPHER_NAME$ ($COLLECTION_NAME$)"`

**View model.**

| Field                     | Type              | Notes                                              |
| ------------------------- | ----------------- | -------------------------------------------------- |
| `approverName`            | string            | Greeting target.                                   |
| `requesterName`           | string            | Who asked.                                         |
| `cipherName`              | string            | Cipher metadata.                                   |
| `collectionName`          | string            | Collection metadata.                               |
| `requestedWindowStart`    | DateTime (UTC)    | Server formats per recipient locale.               |
| `requestedWindowEnd`      | DateTime (UTC)    | Same.                                              |
| `requestedWindowDuration` | string            | Human-readable, e.g. "30 minutes".                 |
| `reason`                  | string (nullable) | User-supplied; may be empty.                       |
| `reviewRequestUrl`        | string            | Absolute URL to `/#/leasing/requests/{requestId}`. |

**HTML body (content block — drop into existing Bitwarden HTML email layout).**

```html
<p>{{i18n "pamLeasePendingApprovalGreeting" approverName}}</p>

<p>{{i18n "pamLeasePendingApprovalIntro" requesterName cipherName collectionName}}</p>

<table role="presentation" cellpadding="6" cellspacing="0" border="0">
  <tr>
    <td><strong>{{i18n "pamLeaseFieldRequester"}}</strong></td>
    <td>{{requesterName}}</td>
  </tr>
  <tr>
    <td><strong>{{i18n "pamLeaseFieldCipher"}}</strong></td>
    <td>{{cipherName}}</td>
  </tr>
  <tr>
    <td><strong>{{i18n "pamLeaseFieldCollection"}}</strong></td>
    <td>{{collectionName}}</td>
  </tr>
  <tr>
    <td><strong>{{i18n "pamLeaseFieldWindow"}}</strong></td>
    <td>{{requestedWindowStart}} &ndash; {{requestedWindowEnd}} ({{requestedWindowDuration}})</td>
  </tr>
  {{#if reason}}
  <tr>
    <td><strong>{{i18n "pamLeaseFieldReason"}}</strong></td>
    <td>{{reason}}</td>
  </tr>
  {{/if}}
</table>

<p>
  <a href="{{reviewRequestUrl}}" class="btn-primary"> {{i18n "pamLeasePendingApprovalCta"}} </a>
</p>

<p style="color:#888;font-size:12px;">{{i18n "pamLeasePendingApprovalFooter"}}</p>
```

**Plain-text body.**

```
{{i18n "pamLeasePendingApprovalGreeting" approverName}}

{{i18n "pamLeasePendingApprovalIntro" requesterName cipherName collectionName}}

  {{i18n "pamLeaseFieldRequester"}}: {{requesterName}}
  {{i18n "pamLeaseFieldCipher"}}: {{cipherName}}
  {{i18n "pamLeaseFieldCollection"}}: {{collectionName}}
  {{i18n "pamLeaseFieldWindow"}}: {{requestedWindowStart}} - {{requestedWindowEnd}} ({{requestedWindowDuration}})
{{#if reason}}  {{i18n "pamLeaseFieldReason"}}: {{reason}}{{/if}}

{{i18n "pamLeasePendingApprovalCtaPlain"}}
{{reviewRequestUrl}}

{{i18n "pamLeasePendingApprovalFooter"}}
```

**New i18n keys.**

| Key                               | English copy                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `pamLeasePendingApprovalSubject`  | `Access request: $CIPHER_NAME$ ($COLLECTION_NAME$)`                                      |
| `pamLeasePendingApprovalGreeting` | `Hi $APPROVER_NAME$,`                                                                    |
| `pamLeasePendingApprovalIntro`    | `$REQUESTER_NAME$ is requesting temporary access to $CIPHER_NAME$ in $COLLECTION_NAME$.` |
| `pamLeasePendingApprovalCta`      | `Review request`                                                                         |
| `pamLeasePendingApprovalCtaPlain` | `Review the request here:`                                                               |
| `pamLeasePendingApprovalFooter`   | `You're receiving this email because you're an approver for this collection.`            |
| `pamLeaseFieldRequester`          | `Requester`                                                                              |
| `pamLeaseFieldCipher`             | `Item`                                                                                   |
| `pamLeaseFieldCollection`         | `Collection`                                                                             |
| `pamLeaseFieldWindow`             | `Requested window`                                                                       |
| `pamLeaseFieldReason`             | `Reason`                                                                                 |

---

### 3.2 `lease_approved_email`

**Trigger.** A `LeaseRequest` transitions to `Approved` (either manually by an approver or automatically by policy — see note below).

**Recipient.** The requester.

**Subject.**

```
Access approved: {{cipherName}}
```

i18n key: `pamLeaseApprovedSubject` → `"Access approved: $CIPHER_NAME$"`

**View model.**

| Field             | Type           | Notes                                                                                                                                                                                 |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requesterName`   | string         | Greeting target.                                                                                                                                                                      |
| `cipherName`      | string         | Cipher metadata.                                                                                                                                                                      |
| `approverDisplay` | string         | Either the human approver's name **or** the localized string `"auto-approved by policy: <policy name>"`. Server resolves the auto-approval phrasing using `pamLeaseApprovedByPolicy`. |
| `windowStart`     | DateTime (UTC) | Active window start.                                                                                                                                                                  |
| `windowEnd`       | DateTime (UTC) | Active window end.                                                                                                                                                                    |
| `windowDuration`  | string         | Human-readable.                                                                                                                                                                       |
| `openCipherUrl`   | string         | Absolute URL to `/#/vault?cipherId={cipherId}`.                                                                                                                                       |

**HTML body.**

```html
<p>{{i18n "pamLeaseApprovedGreeting" requesterName}}</p>

<p>{{i18n "pamLeaseApprovedIntro" cipherName approverDisplay}}</p>

<table role="presentation" cellpadding="6" cellspacing="0" border="0">
  <tr>
    <td><strong>{{i18n "pamLeaseFieldCipher"}}</strong></td>
    <td>{{cipherName}}</td>
  </tr>
  <tr>
    <td><strong>{{i18n "pamLeaseFieldWindow"}}</strong></td>
    <td>{{windowStart}} &ndash; {{windowEnd}} ({{windowDuration}})</td>
  </tr>
</table>

<p>
  <a href="{{openCipherUrl}}" class="btn-primary"> {{i18n "pamLeaseApprovedCta"}} </a>
</p>

<p style="color:#888;font-size:12px;">{{i18n "pamLeaseApprovedFooter"}}</p>
```

**Plain-text body.**

```
{{i18n "pamLeaseApprovedGreeting" requesterName}}

{{i18n "pamLeaseApprovedIntro" cipherName approverDisplay}}

  {{i18n "pamLeaseFieldCipher"}}: {{cipherName}}
  {{i18n "pamLeaseFieldWindow"}}: {{windowStart}} - {{windowEnd}} ({{windowDuration}})

{{i18n "pamLeaseApprovedCtaPlain"}}
{{openCipherUrl}}

{{i18n "pamLeaseApprovedFooter"}}
```

**New i18n keys.**

| Key                        | English copy                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| `pamLeaseApprovedSubject`  | `Access approved: $CIPHER_NAME$`                                        |
| `pamLeaseApprovedGreeting` | `Hi $REQUESTER_NAME$,`                                                  |
| `pamLeaseApprovedIntro`    | `Your access to $CIPHER_NAME$ has been approved by $APPROVER_DISPLAY$.` |
| `pamLeaseApprovedByPolicy` | `auto-approved by policy "$POLICY_NAME$"`                               |
| `pamLeaseApprovedCta`      | `Open item`                                                             |
| `pamLeaseApprovedCtaPlain` | `Open the item here:`                                                   |
| `pamLeaseApprovedFooter`   | `Access ends automatically when the window expires.`                    |

> **Note on `lease_auto_approved`.** PM-37279 explicitly carves the standalone `lease_auto_approved` email out of scope. Auto-approval still surfaces to the requester through `lease_approved_email` using the `pamLeaseApprovedByPolicy` phrasing for `approverDisplay`.

---

### 3.3 `lease_denied_email`

**Trigger.** A `LeaseRequest` transitions to `Denied` (manually or by policy).

**Recipient.** The requester.

**Subject.**

```
Access denied: {{cipherName}}
```

i18n key: `pamLeaseDeniedSubject` → `"Access denied: $CIPHER_NAME$"`

**View model.**

| Field           | Type              | Notes                                                                                                                                         |
| --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `requesterName` | string            | Greeting target.                                                                                                                              |
| `cipherName`    | string            | Cipher metadata.                                                                                                                              |
| `denierDisplay` | string            | Either the human approver's name **or** the localized string `"policy \"<policy name>\""`, resolved server-side via `pamLeaseDeniedByPolicy`. |
| `denialComment` | string (nullable) | User-supplied free text. May be empty.                                                                                                        |
| `myRequestsUrl` | string            | Absolute URL to `/#/leasing/my-requests`.                                                                                                     |

**HTML body.**

```html
<p>{{i18n "pamLeaseDeniedGreeting" requesterName}}</p>

<p>{{i18n "pamLeaseDeniedIntro" cipherName denierDisplay}}</p>

{{#if denialComment}}
<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555;">
  {{denialComment}}
</blockquote>
{{/if}}

<p>
  <a href="{{myRequestsUrl}}" class="btn-primary"> {{i18n "pamLeaseDeniedCta"}} </a>
</p>

<p style="color:#888;font-size:12px;">{{i18n "pamLeaseDeniedFooter"}}</p>
```

**Plain-text body.**

```
{{i18n "pamLeaseDeniedGreeting" requesterName}}

{{i18n "pamLeaseDeniedIntro" cipherName denierDisplay}}
{{#if denialComment}}
{{i18n "pamLeaseFieldComment"}}:
> {{denialComment}}
{{/if}}

{{i18n "pamLeaseDeniedCtaPlain"}}
{{myRequestsUrl}}

{{i18n "pamLeaseDeniedFooter"}}
```

**New i18n keys.**

| Key                      | English copy                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `pamLeaseDeniedSubject`  | `Access denied: $CIPHER_NAME$`                                              |
| `pamLeaseDeniedGreeting` | `Hi $REQUESTER_NAME$,`                                                      |
| `pamLeaseDeniedIntro`    | `Your request for access to $CIPHER_NAME$ was denied by $DENIER_DISPLAY$.`  |
| `pamLeaseDeniedByPolicy` | `policy "$POLICY_NAME$"`                                                    |
| `pamLeaseDeniedCta`      | `View my requests`                                                          |
| `pamLeaseDeniedCtaPlain` | `View your requests here:`                                                  |
| `pamLeaseDeniedFooter`   | `If you still need access, you can submit a new request with more context.` |
| `pamLeaseFieldComment`   | `Comment`                                                                   |

---

### 3.4 `lease_revoked_email`

**Trigger.** An active `Lease` transitions to `Revoked` before its natural expiry (manual approver action).

**Recipient.** The requester (who currently holds the lease).

**Subject.**

```
Access revoked: {{cipherName}}
```

i18n key: `pamLeaseRevokedSubject` → `"Access revoked: $CIPHER_NAME$"`

**View model.**

| Field              | Type              | Notes                                                                                         |
| ------------------ | ----------------- | --------------------------------------------------------------------------------------------- |
| `requesterName`    | string            | Greeting target.                                                                              |
| `cipherName`       | string            | Cipher metadata.                                                                              |
| `approverName`     | string            | The approver who revoked. (Revocation is always a human action — no policy revocation in v0.) |
| `revokedAt`        | DateTime (UTC)    | When the revocation took effect.                                                              |
| `revocationReason` | string (nullable) | Optional approver-supplied note.                                                              |
| `myRequestsUrl`    | string            | Absolute URL to `/#/leasing/my-requests`.                                                     |

**HTML body.**

```html
<p>{{i18n "pamLeaseRevokedGreeting" requesterName}}</p>

<p>{{i18n "pamLeaseRevokedIntro" cipherName approverName revokedAt}}</p>

{{#if revocationReason}}
<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555;">
  {{revocationReason}}
</blockquote>
{{/if}}

<p>
  <a href="{{myRequestsUrl}}" class="btn-primary"> {{i18n "pamLeaseRevokedCta"}} </a>
</p>

<p style="color:#888;font-size:12px;">{{i18n "pamLeaseRevokedFooter"}}</p>
```

**Plain-text body.**

```
{{i18n "pamLeaseRevokedGreeting" requesterName}}

{{i18n "pamLeaseRevokedIntro" cipherName approverName revokedAt}}
{{#if revocationReason}}
{{i18n "pamLeaseFieldReason"}}:
> {{revocationReason}}
{{/if}}

{{i18n "pamLeaseRevokedCtaPlain"}}
{{myRequestsUrl}}

{{i18n "pamLeaseRevokedFooter"}}
```

**New i18n keys.**

| Key                       | English copy                                                                   |
| ------------------------- | ------------------------------------------------------------------------------ |
| `pamLeaseRevokedSubject`  | `Access revoked: $CIPHER_NAME$`                                                |
| `pamLeaseRevokedGreeting` | `Hi $REQUESTER_NAME$,`                                                         |
| `pamLeaseRevokedIntro`    | `Your access to $CIPHER_NAME$ was revoked by $APPROVER_NAME$ at $REVOKED_AT$.` |
| `pamLeaseRevokedCta`      | `View my requests`                                                             |
| `pamLeaseRevokedCtaPlain` | `View your requests here:`                                                     |
| `pamLeaseRevokedFooter`   | `If you still need access, submit a new request.`                              |

---

### 3.5 `lease_expiring_soon_email`

**Trigger.** Scheduled job fires when an active `Lease`'s `expiresAt` is within the configured lead-time window (e.g. 5 minutes). One email per lease.

**Recipient.** The requester (current lease holder).

**Subject.**

```
Access expiring soon: {{cipherName}}
```

i18n key: `pamLeaseExpiringSoonSubject` → `"Access expiring soon: $CIPHER_NAME$"`

**View model.**

| Field                 | Type           | Notes                                                                                      |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `requesterName`       | string         | Greeting target.                                                                           |
| `cipherName`          | string         | Cipher metadata.                                                                           |
| `expiresAt`           | DateTime (UTC) | Absolute expiry.                                                                           |
| `expiresInDuration`   | string         | Human-readable countdown, e.g. "5 minutes".                                                |
| `requestExtensionUrl` | string         | Absolute URL to `/#/leasing/requests/new?cipherId={cipherId}&extendFromLeaseId={leaseId}`. |

**HTML body.**

```html
<p>{{i18n "pamLeaseExpiringSoonGreeting" requesterName}}</p>

<p>{{i18n "pamLeaseExpiringSoonIntro" cipherName expiresInDuration expiresAt}}</p>

<p>
  <a href="{{requestExtensionUrl}}" class="btn-primary"> {{i18n "pamLeaseExpiringSoonCta"}} </a>
</p>

<p style="color:#888;font-size:12px;">{{i18n "pamLeaseExpiringSoonFooter"}}</p>
```

**Plain-text body.**

```
{{i18n "pamLeaseExpiringSoonGreeting" requesterName}}

{{i18n "pamLeaseExpiringSoonIntro" cipherName expiresInDuration expiresAt}}

{{i18n "pamLeaseExpiringSoonCtaPlain"}}
{{requestExtensionUrl}}

{{i18n "pamLeaseExpiringSoonFooter"}}
```

**New i18n keys.**

| Key                            | English copy                                                              |
| ------------------------------ | ------------------------------------------------------------------------- |
| `pamLeaseExpiringSoonSubject`  | `Access expiring soon: $CIPHER_NAME$`                                     |
| `pamLeaseExpiringSoonGreeting` | `Hi $REQUESTER_NAME$,`                                                    |
| `pamLeaseExpiringSoonIntro`    | `Your access to $CIPHER_NAME$ expires in $EXPIRES_IN$ (at $EXPIRES_AT$).` |
| `pamLeaseExpiringSoonCta`      | `Request extension`                                                       |
| `pamLeaseExpiringSoonCtaPlain` | `Request an extension here:`                                              |
| `pamLeaseExpiringSoonFooter`   | `If you do nothing, your access will end automatically.`                  |

> **Note on `lease_expired`.** PM-37279 explicitly carves a separate "your lease has expired" email out of scope. The expiring-soon notice is the only proactive expiry-adjacent communication v0 sends.

---

## 4. Suite-level acceptance checklist

- [ ] All five templates land in `bitwarden/server` under `src/Core/MailTemplates/Handlebars/Pam/` (or the team's chosen equivalent), with matching `.html.hbs` and `.text.hbs` files.
- [ ] Each template has a corresponding typed view-model class and a `MailService` method.
- [ ] All deep links resolve from `globalSettings.baseServiceUri.vault` and are absolute HTTPS.
- [ ] No Vault Data (passwords, notes, custom fields, attachments, TOTP) appears in any template — verified by code review.
- [ ] Subjects use only cipher / collection / user-display metadata; no reason or denial-comment text.
- [ ] User-supplied free text (`reason`, `denialComment`, `revocationReason`) is HTML-escaped (default Handlebars `{{ }}`).
- [ ] All visible strings resolve via i18n keys; English fallback matches the copy in this doc.
- [ ] Clients-repo PR adds the `pamLease...` keys to `apps/web/src/locales/en/messages.json` (and the other shipping locales receive translations through the usual Crowdin flow).
- [ ] Per-recipient throttling exists for `lease_expiring_soon_email` so a lease can never produce more than one expiring-soon email.

---

## 5. Out of scope (this ticket)

- In-product (bell-icon) notifications — separate ticket.
- `lease_auto_approved` standalone email — folded into `lease_approved_email` via `approverDisplay`.
- `lease_expired` post-expiry email — not part of v0.
- Push notifications, SMS, webhook deliveries — not part of the leasing email surface.
