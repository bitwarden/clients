# PAM in the commercial desktop build

- `provide-pam.ts`: `provideDesktopPam()`, wired into `app.module.ts`. Fills `PAM_DESKTOP_ROUTES`,
  `PamNavBadgeService`, the SDK services, the access event and refresh services, and the shared vault
  tokens (`CIPHER_VIEW_BANNER`, `ITEM_DETAILS_BADGE`, `VAULT_ITEM_FILTER`). Modeled on the browser
  popup's and the web vault's `providePam()`. It also fills the vault seams: the gated shared-folder
  banner (`VAULT_GATED_COLLECTION_BANNER`, the shared `GatedCollectionBannerComponent`), the
  Controlled access column (`VAULT_ITEM_COLUMN`, `controlledAccessColumn`) and the row menu
  (`VAULT_ROW_ACTIONS`, see `vault/`). Not filled: PAM revealed-cipher handling and the shared-folder
  lock decoration.
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
  window below 768px on My requests; Resolved by below 768px and Requester below 640px on History
  (the requester then shows under the item); the table scrolls sideways past that. Items link to
  `/pam/requests/:id`.
- `request/pam-request-route.component.*`: the `/pam/requests/:id` host, the desktop counterpart of
  bit-web's `access-request-route`. It opens the shared `AccessRequestDialogComponent` through
  `DialogService` over the tab the caller came from (read off the previous navigation) and, on
  close, replaces the URL with that tab. A `/pam/requests/<id>` notification click lands here.
  `AccessRequestDetailService` is provided on the host because it reads `:id` off the route.
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
  share the one table, as on web, so there is no separate leases section. Columns drop by omission
  with the window: Requested window below 768px, Requester below 640px (shown under the item), and
  the table scrolls sideways past that. A `/pam/approvals` notification click lands here.
- Shared code comes from `@bitwarden/bit-pam` and `@bitwarden/bit-pam-components`; strings live in
  `apps/desktop/src/locales/en/messages.json`.
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
