# PAM in the commercial desktop build

## Wiring

- `provide-pam.ts`: `provideDesktopPam()`, wired into `app.module.ts`. Fills `PAM_DESKTOP_ROUTES`,
  `PamNavBadgeService`, the SDK services, the access event and refresh services, and the shared vault
  tokens (`CIPHER_VIEW_BANNER`, `ITEM_DETAILS_BADGE`, `VAULT_ITEM_FILTER`). Modeled on the browser
  popup's and the web vault's `providePam()`. It also fills the vault seams: the gated shared-folder
  banner (`VAULT_GATED_COLLECTION_BANNER`, `DesktopGatedCollectionBannerComponent`, see `vault/`),
  the Controlled access column (`VAULT_ITEM_COLUMN`, `controlledAccessColumn`) and the row menu
  (`VAULT_ROW_ACTIONS`, see `vault/`), `RevealedCipherService` with
  `DesktopRevealedCipherService` (see `vault/`; one instance, also provided under its own class),
  the shared-folder lock (`SHARED_FOLDER_DECORATION`, the shared `GovernedSharedFolderIconComponent`,
  the same component the web vault binds; it reads only `FeatureFlag.Pam` and the collection's
  server-derived `hasEnabledAccessRule`, so it needs no license or access-rule read and shows the
  same for every member, and the desktop shared-folders page renders the shared `vault-shared-folders`
  list, which honours the token), and the SSH agent's `LeasedSshKeyService` with
  `DesktopLeasedSshKeyService` (see "SSH agent and leased keys" below).

## Unlicensed members

- Unlicensed members (`unlicensedForPam`: a `usePam` organization, `accessPam === false`) get no
  request form anywhere. The shared `CipherViewBannerComponent` shows its unlicensed card on the
  open item; `vault/desktop-gated-collection-banner.component.*` shows `pamSharedFolderUnlicensed`
  on a governed shared folder, read off the synced collection's `hasEnabledAccessRule`, and the
  shared `GatedCollectionBannerComponent` for everyone else.

## Shell and tabs

- `pam-shell.routes.ts` and `pam-shell.component.*`: the `/pam` shell with Approvals, My requests and
  History tabs (`bit-tab-nav-bar` in the desktop header's `tabs` slot). `MyAccessService`,
  `ApproverInboxService` and `AccessNameResolverService` are provided on the shell route so the tabs
  share one instance. Approvals is hidden, and guarded by `canViewApprovalsGuard`, for non-approvers.
- `tabs/pam-my-requests-tab.component.*` and `tabs/pam-history-tab.component.*`: desktop copies of
  bit-web's `my-requests-tab` and `history-tab` (same rows, filters, copy and test ids; keep each
  pair behaving alike). My requests holds undecided requests, unstarted grants and held leases, with
  Start, Cancel, End and Extend; Extend appears only once a per-lease read of the cipher's access
  state says the rule allows it (`LeaseExtensionService.maxExtensionSeconds`), and runs the shared
  extend dialog. Mutations go through `MyAccessService`, which announces them with
  `AccessRefreshService.notifyAccessChanged`. Columns drop by omission, as on Approvals: Requested
  window on My requests; Resolved by, then Requester, on History (the requester then shows under
  the item). Items link to `/pam/requests/:id`.
- `request/pam-request-route.component.*`: the `/pam/requests/:id` host, the desktop counterpart of
  bit-web's `access-request-route`. It opens the shared `AccessRequestDialogComponent` through
  `DialogService` over the tab the caller came from (read off the previous navigation) and, on
  close, replaces the URL with that tab. A `/pam/requests/<id>` notification click lands here.
  `AccessRequestDetailService` is provided on the host because it reads `:id` off the route.

## Vault surfaces and leases

- `vault/desktop-revealed-cipher.service.ts`: the `RevealedCipherService` behind the shared item
  drawer (`VaultItemDialogComponent`) and row menu (`CipherRowMenuService`), a desktop copy of
  bit-web's `PamRevealedCipherService` (keep the two behaving alike). While the active user holds a
  live lease it reads the full view through the SDK's `leasedCipher` and holds it in renderer memory
  only (never state, never IPC, with the one exception of a leased SSH key, below); it drops the view when the lease ends, lapses or reads as gone, on
  an account switch, and on lock or logout. A failed state read keeps the last answer (it can hold a
  reveal, never grant one); a failed or still-partial `leasedCipher` read reveals nothing. Without
  it, the reveal-nothing default from `jslib-services` leaves a leased item with no credentials.
  Lease expiry reads the lease clock (next bullet), never `Date.now()`; on a clock jump or a resume
  it confirms every held view again through `refresh`, and drops any it cannot confirm (offline
  included), rather than keeping the last answer.
- `vault/desktop-leased-clipboard.service.ts`: clears the OS clipboard when a lease ends, if it still
  holds a value copied from that item. Copies carry no item, so it listens to the in-renderer
  `copiedToClipboard` message and counts a copy as leased when it equals a field of a view
  `DesktopRevealedCipherService` holds (not the name) or that view's current TOTP code. It keeps
  only the latest such copy, in renderer memory, and clears with `SystemService`'s check (read,
  compare, write empty) once that view leaves the held map (end, lapse, lock, logout, switch).
- `desktop-access-badge-ticker.service.ts`: `DesktopAccessBadgeTickerService`, provided as
  `AccessBadgeTickerService` too, so every countdown, tab and the revealed view share one clock.
  Its `now()` and ticks read `LeaseClock` from `@bitwarden/bit-pam`: the wall clock while it agrees
  with `performance.now()`, and on a disagreement past 2s the later of the two (a rollback runs on
  at the real rate; a sleep or forward step follows the wall), emitting `clockJumps$`. Web keeps
  the plain `Date.now()` ticker. Not yet on this clock: the notifier's lease boundaries and the
  tabs' and badges' first value before their first tick.
- `vault/desktop-vault-row-actions.service.ts`: `VAULT_ROW_ACTIONS` entries for the desktop vault
  table. Today one, "Cancel request", on a gated row with a pending or approved, unstarted request,
  through the shared `GatedRequestActionsService`. `show` is synchronous, so it reads a snapshot
  that an ask with no answer under 5s old refreshes through one single-shot read (released on its
  answer, so nothing stays subscribed per row), and an account switch clears. Requesting
  access is not a row action: opening the item shows the cipher-view banner and its request form.
- `tabs/pam-approvals-tab.component.*`: the Approvals tab, a desktop copy of bit-web's
  `approvals-tab.component` (same inbox rows, filters, copy and test ids; keep the two behaving
  alike). `ApproverActionsService` is provided on the component; the decide and withdraw dialogs and
  the status badge come from `@bitwarden/bit-pam-components`. Ready, in-use and ending-soon grants
  share the one table, as on web, so there is no separate leases section. Columns drop by omission:
  Requested window, then Requester (shown under the item). A `/pam/approvals` notification click
  lands here.
- `tabs/pam-table-columns.ts`: how all three tabs choose columns. `pamFittingColumns` measures the
  tab host's own width (a `ResizeObserver`; the host is `tw-block`), not the window's, since the
  side nav takes a fixed share of the window, and keeps the droppable columns, most important
  first, while their minimum track widths fit. Each tab passes the minimums of its `bit-column`
  widths, so keep the two in step when changing a column. Item, Status and Actions (Resolved on
  History) always show; the table scrolls sideways only when even those do not fit (the 600px
  minimum window with the side nav open). Specs stub the width with `testing/stub-tab-width.ts`.

## Connectivity and offline rules

- `connectivity/`: whether PAM can reach the server, and the offline rules.
  `DesktopPamConnectivityService` (provided as the shared `PamConnectivityService` seam from
  `@bitwarden/bit-pam`) combines `navigator.onLine` and the window's `online`/`offline` events, any
  server push on `ServerNotificationsService.notifications$` or a successful `syncCompleted` (both
  clear an unreachable server, as does an `online` event), and the outcome of every PAM call.
  `offline$` follows those only once they hold for `PAM_OFFLINE_DEBOUNCE_MS` (2s), so blips do not
  flicker; `reconnected$` ticks on each offline-to-online change. While the network works but the
  server is marked unreachable, a lease read probes every `PAM_RECONNECT_PROBE_INTERVAL_MS` (30s).
  `guardPamCalls` (`pam-call-guard.ts`) wraps the four PAM SDK services in `provide-pam.ts`: every
  call settles within `PAM_CALL_TIMEOUT_MS` (20s); a timeout or a network-class failure (a transport
  error with no HTTP status, a 502/503/504, or any failure while the browser has no network) rejects
  as `PamUnreachableError` and marks the server unreachable; a server refusal (any other HTTP
  status or a decoded server message) is rethrown unchanged and proves the server reachable.
  `DesktopAccessEventService` adds `reconnected$` to `accessChanged$`, so everything that re-reads
  on a push (My requests, the inbox, the nav badge, the notifier, and each item's access state via
  `AccessRefreshService`) re-reads on reconnect; `DesktopRevealedCipherService` also re-reads each
  held reveal then, dropping it if the lease is gone and cutting it to an earlier end, never later.
- Offline rules: offline never grants or extends access. Start, Extend, Request and every approver
  action go to the server or not at all; cached state is never used to start or extend. Every
  PAM action (Request, Start, Extend, End, Cancel, Approve, Deny, Withdraw, and Revoke) is
  disabled offline with the `pamOfflineTooltip` tooltip, on the tabs, the request dialog, the
  decide, withdraw and extend dialogs, and the cipher-view banner and its cards; the vault row's
  "Cancel request" is disabled too, without a tooltip, since `VaultItemsTableRowAction` has none.
  The shell shows the one `PamOfflineBannerComponent` above the tabs (the request dialog relies on
  it); the cipher-view banner shows it on a governed item. Nothing is queued or replayed after a
  reconnect: a failed action is failed, and only reads repeat. A call that never reached the
  server toasts `pamServerUnreachable` (shared `pamFailureMessageKey`); a server refusal keeps its
  own message. End and Cancel on My requests roll their optimistic update back on any failure,
  timeouts included. A cached state can hold a reveal, never extend one: the banner keeps its
  last answer when a read fails (desktop only), so a held lease keeps its countdown and still ends
  at its own `notAfter`; a lease that ends offline shows `pamOfflineAccessEnded` in the banner and
  in its My requests row. Limit: a lease revoked by an approver stays usable offline until its
  normal `notAfter`, since the client cannot hear the revoke; the reconnect re-read drops it.

## Shared code

- Shared code comes from `@bitwarden/bit-pam` and `@bitwarden/bit-pam-components`; strings live in
  `apps/desktop/src/locales/en/messages.json`. The shared surfaces read connectivity through the
  optional `PamConnectivityService` (`injectPamOffline()`), so a client that does not provide it,
  the web vault and the browser extension, behaves as before.

## Notifications

- `notifications/`: system notifications for access requests and decisions.
  `DesktopPamNotifier` (started by an `APP_INITIALIZER` in `provide-pam.ts`) re-reads the approver
  inbox, own requests and leases on each `AccessEventService` tick and at each lease boundary
  (ending soon, ended), one read at a time, and diffs them with `diffPamState` from
  `@bitwarden/bit-pam` against a snapshot of ids and statuses. The first read after login or unlock
  only seeds, as does the first read of a cold start; only a renderer reload in the same window
  session (a session-storage marker) resumes from the snapshot stored per user
  (`PamNotificationStateService`, cleared on logout). A failed read carries that part of the
  snapshot over, and a failed lease read retries in a minute; an approver-less user's inbox counts
  as unread, not empty. It reads only with `FeatureFlag.Pam` and `FeatureFlag.VFO1Foundation` on, a
  `usePam` organization and an unlocked user. The toggle and a visible, focused window withhold
  only the notification, never the snapshot update. `DesktopPamNotificationSink` shows one
  notification per kind through `ipc.platform.showNotification` with count-only text (no item,
  folder, requester or comment text; keep it that way). `PamNotificationsSettingComponent` is the
  "PAM notifications" row (also needing both flags), supplied through `DESKTOP_SETTINGS_EXTRAS`. Routes a notification opens
  must also be in the OSS allowlist `apps/desktop/src/platform/notification-routes.ts`.

## SSH agent and leased keys

- `vault/desktop-leased-ssh-key.service.ts`: `DesktopLeasedSshKeyService` fills the OSS seam
  `LeasedSshKeyService` (`apps/desktop/src/autofill/abstractions/leased-ssh-key.service.ts`), so the
  desktop SSH agent (`SshAgentService`) can use the key of a gated SSH-key item while the user holds
  a live lease. It reads `listMyLeases` (again on each access change and at the nearest lapse; a
  failed read keeps the last answer), asks `DesktopRevealedCipherService` to reveal each gated
  SSH-key item under a live lease, and hands out the revealed key with `leaseEndsAt`, the earlier of
  the lease end and the reveal's end. It needs `FeatureFlag.Pam`, a `usePam` organization and an
  active, unlocked user, and holds only ids and lease ends itself.
- Decision: a leased private key may cross IPC (renderer, main, native agent) on the channel the
  agent already uses for ordinary keys, with expiry and removal guarantees (option a). Rejected: (b)
  keeping leased keys out of the agent, because a revealed SSH key can be copied out of the item
  drawer anyway, so the agent is the more contained way to use it; and (c) signing in the renderer
  per request, because it adds new signing code to this repo and an IPC round trip per signature,
  and fails while the renderer is hidden, throttled or reloading. This is the only exception to
  "never IPC" for revealed content; a security review must sign it off before it ships.
- Guarantees: the key carries `expiresAt` into the native keystore, which neither lists nor hands
  out a key from its expiry on, even with no further push from the renderer. The renderer re-pushes
  on every reveal, drop and extension, and removes all expiring keys (`removeExpiring`, ordinary
  keys stay) on lock, logout and account switch; if that removal fails it stops the agent. A sign
  request for a leased key always opens the approval dialog, whatever the prompt setting, is never
  remembered per host, closes as denied when the lease ends while it is open, and is re-checked
  against the lease, the active user and the lock once answered.
- Out of reach: SSH sessions already open, agents already forwarded to a remote host, and
  signatures already issued stay valid after the lease ends. Keep the PRD saying so.
