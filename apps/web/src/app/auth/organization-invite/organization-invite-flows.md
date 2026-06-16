# Organization Invite Acceptance Flows (Web)

This document maps the end-to-end flows a user takes from clicking an emailed
organization invite link to being a confirmed member of the organization. Web
client only.

If you only remember one thing: **organization invites can be accepted by two
fundamentally different mechanisms**, and which one runs depends on the path
the user takes after clicking the email link.

---

## The two acceptance models

### 1. Client-orchestrated acceptance

The client calls `OrganizationInviteService.validateAndAcceptInvite(invite, userId)`,
which posts to either `postOrganizationUserAccept` or `postOrganizationUserAcceptInit`.
Only one production caller exists:
[`AcceptOrganizationComponent.authedHandler`](./accept-organization.component.ts).

### 2. Server-side acceptance as a side effect of account setup

For SSO JIT-provisioned users (where the server creates a Bitwarden account on
first SSO login), the **server** accepts the user into the org as a side
effect of finishing account setup. The client never calls
`validateAndAcceptInvite` for these users. Which acceptance path runs depends
on the org's configured **member decryption option** — the mechanism users
employ to decrypt their vaults after SSO authentication (configured under the
org's SSO settings):

- **Master password member decryption option**: server's
  `SetInitialMasterPasswordCommand` accepts the user when they submit their
  initial master password.
- **Trusted Device Encryption (TDE) member decryption option**: server
  accepts the user during admin-recovery enrollment (the org feature that
  lets admins recover user accounts via a shared key — TDE users are enrolled
  automatically as part of first-device setup, and the acceptance is bundled
  into that server call).

---

## Entry point: `/accept-organization`

The email link points at `/accept-organization` with query params parsed by
[`OrganizationInvite.fromUrlParams`](../../../../../../../libs/common/src/auth/organization-invite/organization-invite.ts).
Required params: `organizationId`, `organizationUserId`, `email`,
`organizationName`, `token`, `initOrganization`, `orgUserHasExistingUser`.
Optional: `orgSsoIdentifier` (only when the inviting org has SSO + the SSO-login
policy enabled).

`AcceptOrganizationComponent.ngOnInit` hands off to
[`AcceptFlowService.run`](../../../../../../../libs/angular/src/auth/accept-flow/accept-flow.service.ts),
which:

1. Parses the URL via `OrganizationInvite.fromUrlParams`. Returns null →
   error toast + redirect to `/`.
2. Reads `AuthService.activeAccountStatus$`.
3. Dispatches to `authedHandler` (status ≠ `LoggedOut` — `Locked` counts as
   authed) or `unauthedHandler` (status = `LoggedOut`).

**Per-tab session model**: clicking an email link opens a new tab. The new tab
boots with a fresh in-memory auth state, so `unauthedHandler` runs on first
arrival regardless of whether other tabs are signed in.

### unauthedHandler

Stashes the invite to GlobalState **first** (so it survives the navigation
away), then routes via `navigateInviteAcceptance`. The first matching rule
wins:

| Priority | Invite shape                                                        | Destination                           |
| -------- | ------------------------------------------------------------------- | ------------------------------------- |
| 1        | `orgUserHasExistingUser === true`                                   | `/login?email=...`                    |
| 2        | `orgSsoIdentifier` present (and `orgUserHasExistingUser === false`) | `/sso?email=...&identifier=...` (JIT) |
| 3        | none of the above                                                   | `/finish-signup?email=...`            |

Note: an existing user invited to an SSO-required org routes to `/login`, not
`/sso` — they follow the [Existing user](#existing-user-has-a-bitwarden-account)
flow below. The SSO sections cover **new** users JIT-provisioned via SSO.

### authedHandler

Calls `validateAndAcceptInvite(invite, activeUserId)`. Returns `true` → show
success toast + navigate to `/`. Returns `false` → silently exit.

---

## Normal flows (no SSO)

### New user (no Bitwarden account)

1. Click email link → new tab → `/accept-organization`
2. `unauthedHandler` stashes invite → `/finish-signup?email=...`
3. User completes registration form
   - `WebRegistrationFinishService.getOrgNameFromOrgInvite` displays the org name
   - `WebRegistrationFinishService.getMasterPasswordPolicyOptsFromOrgInvite` reads the stashed invite, fetches policies via `getInvitePolicies(invite)`, and applies them to the password validator on the registration form
   - `buildRegisterRequest` attaches the invite token + `organizationUserId` to the server registration request for token validation
4. Server creates the user; client auto-logs them in
5. `deepLinkGuard` replays the persisted `/accept-organization` URL once auth status is `Unlocked` (see [Deep-link replay mechanism](#deep-link-replay-mechanism))
6. `authedHandler` → `validateAndAcceptInvite` → `accept()` → `postOrganizationUserAccept`
7. `clearOrganizationInvite` wipes the stash; success toast; navigate to `/`

**Key invariant**: the registration form enforces the org's MP policy _up front_
because new users are setting a password from scratch. They never see the
post-login force-set-password redirect.

### Existing user (has a Bitwarden account)

1. Click email link → new tab → `/accept-organization`
2. `unauthedHandler` stashes invite → `/login?email=...`
3. User submits their existing master password
   - `LoginComponent.submit` calls `WebLoginComponentService.getOrgPoliciesFromOrgInvite`
   - That reads the stashed invite, validates the email matches (else clears stash + redirect URL), and fetches policies via `getInvitePolicies(invite)`
   - Policies are passed into `PasswordLoginCredentials` as `masterPasswordPoliciesFromOrgInvite`
4. Login proceeds normally. `PasswordLoginStrategy` authenticates successfully regardless of policy compliance.
5. Post-auth, `PasswordLoginStrategy` evaluates the supplied master password against the combined policy options:
   - Compliant → no further action
   - Non-compliant → `masterPasswordService.setForceSetPasswordReason(ForceSetPasswordReason.WeakMasterPassword, userId)`
6. `deepLinkGuard` replays the persisted `/accept-organization` URL once auth status is `Unlocked` (see [Deep-link replay mechanism](#deep-link-replay-mechanism))
7. `authedHandler` → `validateAndAcceptInvite` → `accept()` → `postOrganizationUserAccept`
   - If the org has the reset-password policy with auto-enroll, the user is enrolled in admin password reset during accept (encrypts `userKey` to org public key)
8. `clearOrganizationInvite` wipes the stash; success toast; navigate to `/`
   - If `WeakMasterPassword` was set in step 5, the navigate to `/` triggers [`authGuard`](../../../../../../../libs/angular/src/auth/guards/auth.guard.ts), which inspects `forceSetPasswordReason` and immediately redirects to `/change-password` instead

**Key invariant**: existing users authenticate with their _current_ master
password, then are required to update it _after_ login if it doesn't meet the
org's MP policy. This is intentional — see the comment in
[`password-login.strategy.ts`](../../../../../../../libs/auth/src/common/login-strategies/password-login.strategy.ts)
above the `evaluateMasterPassword` call.

---

## SSO flows

In SSO flows, **the server accepts the user into the org** as a side effect of
account setup (during JIT provisioning + the user's first password/recovery
setup). The client's job is to hand off cleanly to SSO and clean up the
stashed invite + deep-link redirect when control returns. The `orgSsoIdentifier`
URL param is what routes the unauthedHandler to `/sso` instead of `/login` or
`/finish-signup`.

### SSO + Master-Password decryption (JIT-provisioned new user)

New user, JIT-provisioned via SSO, whose org uses master-password decryption.
After SSO they land in a "set initial password" flow.

1. Email link → `/accept-organization` → `unauthedHandler` stashes → `/sso`
2. IdP auth + callback
3. Server JIT-provisions the user
4. Client navigates the user through "set initial password"
5. User submits their new MP → `WebSetInitialPasswordService.setInitialPassword` (or `.initializePasswordJitPasswordUserV2Encryption` for the V2 path — V2 is the current SDK-based encryption path; V1 is the deprecated direct path)
6. Server's `SetInitialMasterPasswordCommand`:
   - Sets the user's master password hash + key
   - Accepts the user into the org (the side effect)
7. Client-side cleanup, in `WebSetInitialPasswordService`:
   - `routerService.getAndClearLoginRedirectUrl()` — drops the `/accept-organization` redirect
   - `organizationInviteService.clearOrganizationInvite()` — drops the stash
8. User lands in `/vault`

The cleanup is critical: without it, the deep-link redirect would bounce the
user back to `/accept-organization` after they've already been accepted, where
`authedHandler` would call `validateAndAcceptInvite` against an org they're
already a member of.

### SSO + TDE (Trusted Device Encryption)

**Net-new** TDE users (JIT-provisioned into an org that already has TDE selected
as its SSO decryption option) don't have a master password — their
account-setup side-effect path is admin-recovery enrollment rather than
initial-password-set.

**Pre-existing MP users converted to TDE** retain their master password — they
were enrolled before the org switched its SSO decryption option to TDE, and
the MP isn't retired on conversion. Their accept flow stays on the MP-SSO
path described above, not this one.

The flow below covers the net-new TDE case:

1. Email link → `/accept-organization` → `unauthedHandler` stashes → `/sso`
2. IdP auth + callback
3. Server JIT-provisions the user
4. Client routes through [`LoginDecryptionOptionsComponent`](../../../../../../../libs/auth/src/angular/login-decryption-options/login-decryption-options.component.ts) for TDE setup
5. Server accepts the user into the org during admin-recovery enrollment (see the admin-recovery gloss under "The two acceptance models")
6. Client-side cleanup, in `WebLoginDecryptionOptionsService.handleCreateUserSuccess`:
   - `routerService.getAndClearLoginRedirectUrl()`
   - `organizationInviteService.clearOrganizationInvite()`
7. User completes device-trust setup and lands in `/vault`

### Why two cleanup points

MP-SSO cleans up in `WebSetInitialPasswordService`, TDE-SSO in
`WebLoginDecryptionOptionsService` — different services own the two
account-setup paths. Consolidation tracked in
[PM-22615](https://bitwarden.atlassian.net/browse/PM-22615).

---

## Edge / historical cases

### Email mismatch

`WebLoginComponentService.getOrgPoliciesFromOrgInvite` compares the
form-submitted email to the stashed invite's email. If they differ, it clears
both the stash and the deep-link redirect URL. This handles the case where
userA stashes an invite, then userB attempts to log in on the same machine with
a different email.

### Init-organization invites

Invites with `initOrganization === true` are for orgs that were provisioned
in a `Pending` state (no keys yet) — either by a reseller/provider signing
up a client org on a customer's behalf, or re-sent from the internal
Bitwarden admin portal. The customer-owner clicking the link is the first
time the org gets initialized: `validateAndAcceptInvite` routes to
`acceptAndInitOrganization` instead of the normal accept path — it generates
org keys, a default collection, and posts `OrganizationUserAcceptInitRequest`.
No MP-policy check happens for init invites because the user is the org's
first (and currently only) member.

### Authed user pastes the accept-invite URL directly

The expected entry is clicking the email link, which opens a new (unauthed)
tab and runs `unauthedHandler` — that stashes the invite **before** routing
to `/login`. But a user can also copy the accept-invite URL out of the email
and paste it into a tab that's already signed in. In that case:

1. `AcceptFlowService.run` reads `activeAccountStatus$` as authed and
   dispatches straight to `authedHandler`.
2. `authedHandler` calls `validateAndAcceptInvite` with **no stash present**
   (because `unauthedHandler` never ran).
3. If the inviting org has the MP policy enabled,
   `masterPasswordPolicyCheckRequired` returns `true` (policy enabled +
   no stored invite = user has not been redirected through the MP check
   yet). The service then stashes the invite and calls
   `authService.logOut` — see
   [`default-organization-invite.service.ts`](../../../../../../../libs/common/src/auth/organization-invite/default-organization-invite.service.ts)
   (the branch inside `validateAndAcceptInvite`).
4. Logout returns the user to `/login`, where the existing-user flow runs
   normally: the stash drives policy fetching, the MP is evaluated against
   the org's policy, and a non-compliant password triggers the post-login
   force-set-password redirect.
5. After login, `deepLinkGuard` replays `/accept-organization` and
   `authedHandler` runs again — this time the stash is present, so
   `masterPasswordPolicyCheckRequired` returns `false` and `accept()` runs.

The branch is unit-tested in
[`default-organization-invite.service.spec.ts`](../../../../../../../libs/common/src/auth/organization-invite/default-organization-invite.service.spec.ts)
("logs out the user and stores the invite when a master password policy check
is required"), but there is no end-to-end / component-level test exercising
the paste-into-authed-session entry. Worth covering.

---

## State and dependencies

### The stash

`OrganizationInvite` is persisted to disk via `GlobalStateProvider` under the
`ORGANIZATION_INVITE_DISK` key (see
[`organization-invite-state.ts`](../../../../../../../libs/common/src/auth/organization-invite/organization-invite-state.ts)).
Disk persistence is what makes the stash survive the navigation away to
`/login` / `/sso` / `/finish-signup` and the SSO IdP round-trip.

**Scope**: it's a single nullable slot in `GlobalState` (typed
`OrganizationInvite | null`) — **not** keyed by user, not a map of invites.
That means:

- The slot is shared across tabs **and across users on the same install**. If
  userA clicks an invite and userB later signs in on the same browser, userA's
  invite is still sitting in disk state until something clears it.
- This is why the email-mismatch guards exist in
  `masterPasswordPolicyCheckRequired` and
  `WebLoginComponentService.getOrgPoliciesFromOrgInvite`: they compare the
  submitted email against the stashed invite's email and clear the stash on
  mismatch, because nothing else scopes the slot to a user.
- Last write wins. Two invites clicked in quick succession before the first
  finishes will overwrite each other — there's no queue.

### Deep-link replay mechanism

These flows depend on **two** disk-persisted pieces of state surviving the
authentication detour:

1. The org invite itself, in `OrganizationInviteService` GlobalState
   (`ORGANIZATION_INVITE_DISK`).
2. The pre-auth URL, in `RouterService` GlobalState (`deepLinkRedirectUrl`),
   managed by [`deepLinkGuard`](../guards/deep-link/deep-link.guard.ts).

`deepLinkGuard` is a `CanActivateFn` attached to the routes a user could deep
link into. It runs on every navigation to a guarded route:

- **Unauthed/Locked**: persist the current URL via
  `routerService.persistLoginRedirectUrl(currentUrl)`, then let the navigation
  proceed.
- **Unlocked**: read the persisted URL via
  `routerService.getAndClearLoginRedirectUrl()`. If one exists, issue
  `router.navigateByUrl(persistedPreLoginUrl)` — this is what "replays" the
  deep link after authentication.

In the org-invite flows: user hits `/accept-organization` unauthed → guard
persists that URL → unauthedHandler navigates them away → after auth completes,
the next navigation to a guard-protected route (`/` typically) fires the
navigateByUrl that sends them back. `authedHandler` then runs on the
re-mount.

### Policy cache

`DefaultOrganizationInviteService.getInvitePolicies(invite)` caches the policy
list per invite token on the service instance. The cache is cleared on
`setOrganizationInvite` and `clearOrganizationInvite` so a state transition
never leaks stale entries. See the field comment in
[`default-organization-invite.service.ts`](../../../../../../../libs/common/src/auth/organization-invite/default-organization-invite.service.ts).
