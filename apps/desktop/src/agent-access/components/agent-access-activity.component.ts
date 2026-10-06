import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { map, of, switchMap } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  BadgeModule,
  BadgeVariant,
  BitwardenIcon,
  NoItemsModule,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AgentAccessActivityEntry,
  AgentAccessActivityType,
  AgentAccessRequestStatus,
  CredentialRequestActivity,
} from "../models/agent-access-activity";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { AgentAccessOperation } from "../models/agent-access-operation";
import { AgentAccessResourceType } from "../models/agent-access-resource-type";
import { CredentialQueryType } from "../models/credential-query-type";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import { AgentAccessSecretsService } from "../services/agent-access-secrets.service";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

/** Newest-first activity log is capped at this many rows, matching the main-process buffer. */
const MAX_DISPLAYED_ENTRIES = 200;

/**
 * Maps a lifecycle entry's `kind` (a snake_case string forwarded from Rust, not a TS enum — see
 * `agent_access::AgentAccessEvent`) to an i18n key. A const object rather than an enum, per repo
 * convention. Unknown kinds (future Rust additions) fall back to the raw string so the log stays
 * forward-compatible without a client release.
 */
const LIFECYCLE_LABEL_KEYS = Object.freeze({
  connection_established: "agentAccessEventConnectionEstablished",
  session_refreshed: "agentAccessEventSessionRefreshed",
  connection_rejected: "agentAccessEventConnectionRejected",
  reconnecting: "agentAccessEventReconnecting",
  reconnected: "agentAccessEventReconnected",
  error: "agentAccessEventError",
  handshake_completed: "agentAccessEventHandshakeCompleted",
} as const);

/**
 * Lifecycle `kind`s that are a *fault* — an anomaly in the connection itself that may need the
 * user's attention — as opposed to a routine state transition. This is a deliberately separate
 * axis from the consequence grade: grade answers "what happened to the vault" (see
 * {@link AgentAccessActivityComponent.lifecycleGrade}), and no lifecycle event ever touches the
 * vault, so every one of them grades as `metadata`. Fault answers a different question — "does
 * this row need a second look" — and is layered on top with its own signal
 * ({@link AgentAccessActivityComponent.lifecycleVariant}), not borrowed from the `destroy`
 * grade's red (which would misleadingly imply something irreversible happened to vault data).
 *
 * `connection_rejected` is deliberately **not** here: a rejected connection is the system working
 * as designed (the user, or an automatic gate, said no) — colouring it as a fault would train the
 * user to read their own correct decision as a failure. `error` is the one lifecycle kind that
 * genuinely represents something going wrong.
 */
const LIFECYCLE_FAULT_KINDS: ReadonlySet<string> = new Set(["error"]);

/**
 * i18n key per credential-request outcome. Colour used to live alongside this as a per-status
 * `variant`, chosen independently of the lifecycle table below — two parallel, ad hoc colour
 * systems. Both are now unified behind the consequence grade
 * (agent-access-design-spec.md §2.1, §3.5): see {@link AgentAccessActivityComponent.requestGrade}
 * and {@link GRADE_BADGE_VARIANTS}. This map keeps only the label.
 */
const REQUEST_STATUS_LABEL_KEYS: Readonly<Record<AgentAccessRequestStatus, string>> = Object.freeze(
  {
    [AgentAccessRequestStatus.Pending]: "agentAccessStatusPending",
    [AgentAccessRequestStatus.Shared]: "agentAccessStatusShared",
    [AgentAccessRequestStatus.Denied]: "agentAccessStatusDenied",
    [AgentAccessRequestStatus.NotFound]: "agentAccessStatusNotFound",
    [AgentAccessRequestStatus.Created]: "agentAccessStatusCreated",
    [AgentAccessRequestStatus.Filled]: "agentAccessStatusFilled",
    [AgentAccessRequestStatus.FillFailed]: "agentAccessStatusFillFailed",
    [AgentAccessRequestStatus.Updated]: "agentAccessStatusUpdated",
    [AgentAccessRequestStatus.Deleted]: "agentAccessStatusDeleted",
    [AgentAccessRequestStatus.Listed]: "agentAccessStatusListed",
  },
);

/**
 * Badge colour per consequence grade (agent-access-design-spec.md §2.2), reused by both row
 * shapes so the same colour means the same thing everywhere in the log — the whole point of
 * bringing the log into the dialogs' system (spec §3.5). `bit-badge` only accepts one of its own
 * closed `BadgeVariant` set, not §2.2's raw `tw-border-*`/`tw-bg-*` classes directly (that raw
 * treatment is `app-agent-access-consequence`'s, a shared dialog component out of this file's
 * lane), so each grade maps to the nearest existing variant whose own token bindings
 * (`badge.component.ts`'s `variantStyles`) already resolve to an equivalent or identical
 * background/text pair: `change`, `disclose`, and `destroy` land on a badge variant whose
 * background/text tokens are an exact match for §2.2's table (`primary`, `warning`, `danger`
 * respectively); `metadata` lands on `subtle`, whose background/border match §2.2's `metadata`
 * row exactly (its text token is `fg-body` rather than `text-muted` — the nearest existing option
 * without inventing a new `BadgeVariant`, which is out of this file's lane).
 */
const GRADE_BADGE_VARIANTS: Readonly<Record<AgentAccessConsequence, BadgeVariant>> = Object.freeze({
  [AgentAccessConsequence.Metadata]: "subtle",
  [AgentAccessConsequence.Change]: "primary",
  [AgentAccessConsequence.Disclose]: "warning",
  [AgentAccessConsequence.Destroy]: "danger",
});

/** Icon per consequence grade, identical to §2.2's table and to
 *  `app-agent-access-consequence`'s own icon map, so the badge carries the same glyph the user
 *  saw on the approval dialog. */
const GRADE_BADGE_ICONS: Readonly<Record<AgentAccessConsequence, BitwardenIcon>> = Object.freeze({
  [AgentAccessConsequence.Metadata]: "bwi-list",
  [AgentAccessConsequence.Change]: "bwi-pencil",
  [AgentAccessConsequence.Disclose]: "bwi-key",
  [AgentAccessConsequence.Destroy]: "bwi-trash",
});

/** i18n key per query type, used to caption the query text (e.g. `Domain  github.com`). The
 *  exhaustive `Record<CredentialQueryType, string>` forces a new entry whenever napi's
 *  `CredentialQueryType` gains a member (agent-access-architecture.md, "M4" added `Name`, for
 *  Secrets Manager secret key lookups). */
const QUERY_TYPE_LABEL_KEYS: Readonly<Record<CredentialQueryType, string>> = Object.freeze({
  [CredentialQueryType.Domain]: "agentAccessQueryTypeDomain",
  [CredentialQueryType.Id]: "agentAccessQueryTypeId",
  [CredentialQueryType.Search]: "agentAccessQueryTypeSearch",
  [CredentialQueryType.Name]: "agentAccessQueryTypeName",
});

const ACTIVITY_COMMAND = new CommandDefinition<{ entry: AgentAccessActivityEntry }>(
  AGENT_ACCESS_IPC_CHANNELS.ACTIVITY,
);
const ACTIVITY_RESET_COMMAND = new CommandDefinition<Record<string, never>>(
  AGENT_ACCESS_IPC_CHANNELS.ACTIVITY_RESET,
);

/**
 * "Activity" tab of the Agent Access page: a live table of credential requests and connection
 * events. Independent of `AgentAccessPageStateService` — the log is historical and shows past
 * activity regardless of whether the agent is currently running.
 *
 * One credential request is one row for its whole life: the main process opens the row as
 * `Pending` when the request is dispatched and resolves it in place when the user answers, so the
 * query and its outcome are read off a single line rather than two adjacent entries. Live pushes
 * are therefore upserts by `id`, not appends.
 *
 * The main process, not this component, owns the buffer: the log is re-fetched whenever the tab is
 * entered, and again whenever the main process signals that it cleared the buffer (account switch).
 *
 * Released items are stored as ids and named here, against the live vault — see
 * {@link AgentAccessActivityComponent.cipherNames}.
 */
@Component({
  selector: "app-agent-access-activity",
  templateUrl: "agent-access-activity.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, I18nPipe, BadgeModule, NoItemsModule, TableModule, TypographyModule],
})
export class AgentAccessActivityComponent implements OnInit {
  private readonly messageListener = inject(MessageListener);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly agentAccessSecretsService = inject(AgentAccessSecretsService);

  /** Empty-state icon for the activity log. */
  protected readonly NoResults = NoResults;
  protected readonly AgentAccessActivityType = AgentAccessActivityType;
  protected readonly AgentAccessResourceType = AgentAccessResourceType;
  protected readonly CredentialQueryType = CredentialQueryType;

  /** Oldest -> newest, exactly as the main process holds it. */
  private readonly entries = signal<AgentAccessActivityEntry[]>([]);

  /** Newest first, for display. */
  protected readonly rows = computed(() => [...this.entries()].reverse());

  /**
   * Item id -> name, from the *live* vault of the *active* account.
   *
   * This is why the activity log stores ids and never names: nothing decrypted is persisted
   * anywhere, so there is no vault content to redact when the vault locks or to leak when the
   * account changes — the lookup simply stops resolving, and starts again on unlock. An id that
   * no longer resolves (deleted item, locked vault, different account) degrades to the fields-only
   * label in {@link requestResultLabel}.
   */
  private readonly cipherNames = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account == null ? of([]) : this.cipherService.cipherViews$(account.id),
      ),
      map((ciphers) => new Map((ciphers ?? []).map((cipher) => [cipher.id, cipher.name]))),
    ),
    { initialValue: new Map<string, string>() },
  );

  async ngOnInit() {
    await this.refresh();

    this.messageListener
      .messages$(ACTIVITY_COMMAND)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ entry }) => this.upsert(entry));

    this.messageListener
      .messages$(ACTIVITY_RESET_COMMAND)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.refresh());
  }

  private async refresh(): Promise<void> {
    this.entries.set(await ipc.agentAccess.getActivity());
  }

  /**
   * Replaces an entry in place when the main process resolves one it already pushed, otherwise
   * appends. Replacing in place is what keeps a resolved request in its chronological slot instead
   * of jumping to the top of the table the moment the user answers the dialog.
   */
  private upsert(entry: AgentAccessActivityEntry): void {
    this.entries.update((current) => {
      const index = current.findIndex((existing) => existing.id === entry.id);
      if (index !== -1) {
        // New array reference, per OnPush.
        const next = [...current];
        next[index] = entry;
        return next;
      }
      return [...current, entry].slice(-MAX_DISPLAYED_ENTRIES);
    });
  }

  protected entryDate(timestampMs: string): Date {
    return new Date(Number(timestampMs));
  }

  /** Who asked: the resolved agent name, else a shortened fingerprint, else a dash. */
  protected agentLabel(entry: AgentAccessActivityEntry): string {
    if (entry.agentName) {
      return entry.agentName;
    }
    if (entry.agentFingerprint) {
      return shortenFingerprint(entry.agentFingerprint);
    }
    return "—";
  }

  protected lifecycleLabel(kind: string): string {
    const labelKey = (LIFECYCLE_LABEL_KEYS as Record<string, string>)[kind];
    return labelKey ? this.i18nService.t(labelKey) : kind;
  }

  /**
   * Connection/transport events never release a secret value or change vault contents, so every
   * `kind` grades as `metadata` (agent-access-design-spec.md §2.1) — the badge's *label* still
   * names the specific event (see {@link lifecycleLabel}); only its colour is unified with
   * {@link requestGrade}, so `subtle` means the same thing (nothing crossed the boundary) on
   * either row shape. This is the *consequence* axis only — see {@link isLifecycleFault} for the
   * separate *fault* axis layered on top of it.
   */
  protected lifecycleGrade(): AgentAccessConsequence {
    return AgentAccessConsequence.Metadata;
  }

  /** Whether `kind` is an anomaly worth flagging on its own terms, independent of consequence
   *  grade — see {@link LIFECYCLE_FAULT_KINDS}'s doc for why this is a separate axis and why
   *  `connection_rejected` is deliberately excluded. */
  protected isLifecycleFault(kind: string): boolean {
    return LIFECYCLE_FAULT_KINDS.has(kind);
  }

  /**
   * A fault overrides the grade-derived colour with the badge library's own `danger` treatment.
   * Deliberately **not** routed through {@link gradeVariant}/{@link GRADE_BADGE_VARIANTS} — this
   * red means "this connection had a problem", never "this grades as `destroy`", and keeping the
   * two paths visibly separate in code is what stops that from being ambiguous to a future
   * reader. Every other kind, including `connection_rejected`, is coloured by grade alone.
   */
  protected lifecycleVariant(kind: string): BadgeVariant {
    return this.isLifecycleFault(kind) ? "danger" : this.gradeVariant(this.lifecycleGrade());
  }

  /** See {@link lifecycleVariant}. `bwi-error` is the fault's own icon — never `bwi-trash` (the
   *  `destroy` grade's icon), which would misleadingly suggest something irreversible happened to
   *  vault data rather than a connection fault. */
  protected lifecycleIcon(kind: string): BitwardenIcon {
    return this.isLifecycleFault(kind) ? "bwi-error" : this.gradeIcon(this.lifecycleGrade());
  }

  protected statusLabel(status: AgentAccessRequestStatus): string {
    return this.i18nService.t(REQUEST_STATUS_LABEL_KEYS[status]);
  }

  /**
   * The row's consequence grade (agent-access-design-spec.md §2.1), derived from what actually
   * happened — resource type, operation, and outcome status — never inferred from a field a
   * given request path may not populate (the trap `isReferenceMode` fell into on the dialog side,
   * spec §3.3 BUG 2: the secret path never sets `deliveryMode`, so a field-based inference would
   * silently be wrong there too). This is the single source of truth for the result badge's
   * colour and icon; see {@link statusVariant}.
   */
  protected requestGrade(entry: CredentialRequestActivity): AgentAccessConsequence {
    switch (entry.status) {
      case AgentAccessRequestStatus.Shared:
        // A bulk project-secrets release or a single Secrets Manager secret always discloses a
        // value — neither has a reference mode (agent-access-design-spec.md §3.2:
        // `project-secrets-request` and the secret-kind `approve-credential-request` are both
        // graded `disclose`). A vault-credential row discloses only when the password field
        // itself was released; `fieldsShared` without `"password"` is the reference-delivery
        // case, whose entire point is that the password never leaves the device.
        if (this.isBulkSecretsRequest(entry) || this.isSecretRequest(entry)) {
          return AgentAccessConsequence.Disclose;
        }
        return entry.fieldsShared?.includes("password")
          ? AgentAccessConsequence.Disclose
          : AgentAccessConsequence.Metadata;
      case AgentAccessRequestStatus.Filled:
        // A browser fill always types a stored value into the page — `approve-fill-request` is
        // graded `disclose` for the same reason (spec §3.2).
        return AgentAccessConsequence.Disclose;
      case AgentAccessRequestStatus.Created:
      case AgentAccessRequestStatus.Updated:
        // Vault contents created or modified; nothing existing is disclosed (spec §2.1 `change`).
        return AgentAccessConsequence.Change;
      case AgentAccessRequestStatus.Deleted:
        // Irreversible removal (spec §2.1 `destroy`).
        return AgentAccessConsequence.Destroy;
      case AgentAccessRequestStatus.Pending:
      case AgentAccessRequestStatus.Denied:
      case AgentAccessRequestStatus.NotFound:
      case AgentAccessRequestStatus.FillFailed:
      case AgentAccessRequestStatus.Listed:
      default:
        // Nothing left the device and nothing in the vault changed: an unresolved request, a
        // refusal, a miss, a failed fill, or a project *list* (names/ids only — spec §2.1
        // `metadata`).
        return AgentAccessConsequence.Metadata;
    }
  }

  protected statusVariant(entry: CredentialRequestActivity): BadgeVariant {
    return this.gradeVariant(this.requestGrade(entry));
  }

  protected statusIcon(entry: CredentialRequestActivity): BitwardenIcon {
    return this.gradeIcon(this.requestGrade(entry));
  }

  protected gradeVariant(grade: AgentAccessConsequence): BadgeVariant {
    return GRADE_BADGE_VARIANTS[grade];
  }

  protected gradeIcon(grade: AgentAccessConsequence): BitwardenIcon {
    return GRADE_BADGE_ICONS[grade];
  }

  protected queryTypeLabel(queryType: CredentialQueryType): string {
    return this.i18nService.t(QUERY_TYPE_LABEL_KEYS[queryType]);
  }

  /** Whether a credential-request row asked for a Secrets Manager secret rather than a vault
   *  login. Defaults to `Credential` when `resourceType` is absent (older activity rows written
   *  before M4, or napi omitting it) — see `AgentAccessResourceType`'s doc. */
  protected isSecretRequest(entry: CredentialRequestActivity): boolean {
    return entry.resourceType === AgentAccessResourceType.Secret;
  }

  /** Whether a row is a Secrets Manager secret *creation* rather than a lookup
   *  (agent-access-architecture.md, "M4b"). Defaults to `Request` when `operation` is absent
   *  (every pre-M4b row, or a narrowing failure) — see `AgentAccessOperation`'s doc. This is also
   *  why a create row has no `queryType`/`queryValue` to render: see `queryType`'s doc on
   *  `CredentialRequestActivity`. */
  protected isCreateRequest(entry: CredentialRequestActivity): boolean {
    return entry.operation === AgentAccessOperation.Create;
  }

  /** Whether a row is a `projectSecretsRequest` bulk release (agent-access-architecture.md,
   *  "M7") rather than a single-secret lookup — both are `resourceType: "secret"`, so this keys
   *  off `operation` instead. Like a create row, a bulk row has no `queryType`/`queryValue`
   *  (force-filled out main-side, same `operation !== Request` gate M6 generalized). */
  protected isBulkSecretsRequest(entry: CredentialRequestActivity): boolean {
    return entry.operation === AgentAccessOperation.BulkRequest;
  }

  /**
   * What the request produced, as one line: the released item and its fields when the user
   * approved, otherwise a short explanation of why nothing was released. Returns `undefined` while
   * the request is still pending — the status badge already says so.
   *
   * The released name comes from {@link cipherNames} for a credential row, or from
   * `AgentAccessSecretsService.resolveSecretName` for a secret row — never from the entry itself,
   * which stores only ids (SECURITY: no decrypted Vault/SM data persists outside the renderer's
   * own in-memory caches). A secret name that isn't resolved (not looked up this session) falls
   * back to the raw query value, since that's the best a user can be shown without decrypting
   * anything new just to render a log row.
   */
  protected requestResultLabel(entry: CredentialRequestActivity): string | undefined {
    switch (entry.status) {
      case AgentAccessRequestStatus.Shared: {
        // M7 (`projectSecretsRequest`): the sole bulk-value release. Distinguished by
        // `operation`, not `resourceType` — a bulk row is `resourceType: "secret"` just like a
        // single-secret `Shared` row, but the label names the count and the *project*, never an
        // individual secret name (agent-access-architecture.md, "M7": "Shared N secrets from
        // project {name}"). `secretIds.length` drives the count, never `fieldsShared` (a bulk row
        // sets no `fieldsShared` — there is no single item's fields to summarize).
        if (this.isBulkSecretsRequest(entry)) {
          const projectName =
            (entry.projectId
              ? this.agentAccessSecretsService.resolveProjectName(entry.projectId)
              : undefined) ?? this.i18nService.t("agentAccessBulkProjectFallbackName");
          const count = entry.secretIds?.length ?? 0;
          return this.i18nService.t("agentAccessSharedProjectSecrets", count, projectName);
        }
        const fields = entry.fieldsShared?.join(", ") ?? "";
        if (this.isSecretRequest(entry)) {
          const secretName =
            (entry.secretId
              ? this.agentAccessSecretsService.resolveSecretName(entry.secretId)
              : undefined) ?? entry.queryValue;
          return this.i18nService.t("agentAccessSharedItemFields", secretName, fields);
        }
        const cipherName = entry.cipherId ? this.cipherNames().get(entry.cipherId) : undefined;
        return cipherName
          ? this.i18nService.t("agentAccessSharedItemFields", cipherName, fields)
          : this.i18nService.t("agentAccessSharedFields", fields);
      }
      case AgentAccessRequestStatus.Created: {
        // Never falls back to `entry.queryValue` — a create row never has one (see `queryType`'s
        // doc on `CredentialRequestActivity`: the main process omits it specifically because it
        // would otherwise carry the secret's name). The generic fallback below is the only
        // option when the name isn't in this session's cache (e.g. the app restarted since).
        const secretName =
          (entry.secretId
            ? this.agentAccessSecretsService.resolveSecretName(entry.secretId)
            : undefined) ?? this.i18nService.t("agentAccessCreateFallbackName");
        return this.i18nService.t("agentAccessCreatedItem", secretName);
      }
      case AgentAccessRequestStatus.Filled: {
        // A fill row reads like a Shared one — the item and the roles written — because the same
        // reference-model rules apply: the row stores the id, the name resolves from the live
        // vault at render time (agent-access-architecture.md, "M5": metadata only).
        const fields = entry.fieldsShared?.join(", ") ?? "";
        const cipherName = entry.cipherId ? this.cipherNames().get(entry.cipherId) : undefined;
        return cipherName
          ? this.i18nService.t("agentAccessSharedItemFields", cipherName, fields)
          : this.i18nService.t("agentAccessSharedFields", fields);
      }
      case AgentAccessRequestStatus.FillFailed:
        return this.i18nService.t("agentAccessFillResultFailed");
      case AgentAccessRequestStatus.Updated: {
        const name =
          this.resolveWriteTargetName(entry) ?? this.i18nService.t("agentAccessUpdateFallbackName");
        return this.i18nService.t("agentAccessUpdatedItem", name);
      }
      case AgentAccessRequestStatus.Deleted: {
        const name =
          this.resolveWriteTargetName(entry) ?? this.i18nService.t("agentAccessDeleteFallbackName");
        return this.i18nService.t("agentAccessDeletedItem", name);
      }
      case AgentAccessRequestStatus.Listed:
        return this.i18nService.t("agentAccessResultListed");
      case AgentAccessRequestStatus.NotFound:
        return this.i18nService.t("agentAccessResultNoMatch");
      case AgentAccessRequestStatus.Denied:
        return this.i18nService.t("agentAccessResultDenied");
      default:
        return undefined;
    }
  }

  /**
   * Resolves an `Updated`/`Deleted` row's target name from the session-scoped cache — a secret
   * name via `resolveSecretName` (keyed by `secretId`) or a project name via
   * `resolveProjectName` (keyed by `projectId`), depending on `resourceType`. Never falls back to
   * `entry.queryValue` — an update/delete row never has one (the same reason a create row
   * doesn't; see `queryType`'s doc on `CredentialRequestActivity`) — the caller falls back to a
   * generic label instead, exactly like a `Created` row does.
   */
  private resolveWriteTargetName(entry: CredentialRequestActivity): string | undefined {
    if (entry.resourceType === AgentAccessResourceType.Project) {
      return entry.projectId
        ? this.agentAccessSecretsService.resolveProjectName(entry.projectId)
        : undefined;
    }
    return entry.secretId
      ? this.agentAccessSecretsService.resolveSecretName(entry.secretId)
      : undefined;
  }
}
