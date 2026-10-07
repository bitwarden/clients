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

/** Badge color per lifecycle `kind`. Anything unmapped renders neutral. */
const LIFECYCLE_BADGE_VARIANTS: Readonly<Record<string, BadgeVariant>> = Object.freeze({
  connection_established: "success",
  session_refreshed: "subtle",
  connection_rejected: "danger",
  reconnecting: "warning",
  reconnected: "success",
  error: "danger",
  handshake_completed: "subtle",
});

/** i18n key + badge color per credential-request outcome. */
const REQUEST_STATUS_META: Readonly<
  Record<AgentAccessRequestStatus, { labelKey: string; variant: BadgeVariant }>
> = Object.freeze({
  [AgentAccessRequestStatus.Pending]: {
    labelKey: "agentAccessStatusPending",
    variant: "subtle",
  },
  [AgentAccessRequestStatus.Shared]: { labelKey: "agentAccessStatusShared", variant: "success" },
  [AgentAccessRequestStatus.Denied]: { labelKey: "agentAccessStatusDenied", variant: "danger" },
  [AgentAccessRequestStatus.NotFound]: {
    labelKey: "agentAccessStatusNotFound",
    variant: "warning",
  },
  [AgentAccessRequestStatus.Created]: {
    labelKey: "agentAccessStatusCreated",
    variant: "success",
  },
  [AgentAccessRequestStatus.Filled]: {
    labelKey: "agentAccessStatusFilled",
    variant: "success",
  },
  [AgentAccessRequestStatus.FillFailed]: {
    labelKey: "agentAccessStatusFillFailed",
    variant: "warning",
  },
  [AgentAccessRequestStatus.Updated]: {
    labelKey: "agentAccessStatusUpdated",
    variant: "success",
  },
  [AgentAccessRequestStatus.Deleted]: {
    labelKey: "agentAccessStatusDeleted",
    variant: "danger",
  },
  [AgentAccessRequestStatus.Listed]: {
    labelKey: "agentAccessStatusListed",
    variant: "subtle",
  },
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

  protected lifecycleVariant(kind: string): BadgeVariant {
    return LIFECYCLE_BADGE_VARIANTS[kind] ?? "subtle";
  }

  protected statusLabel(status: AgentAccessRequestStatus): string {
    return this.i18nService.t(REQUEST_STATUS_META[status].labelKey);
  }

  protected statusVariant(status: AgentAccessRequestStatus): BadgeVariant {
    return REQUEST_STATUS_META[status].variant;
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
    // OpenShell rows (§M8.8) record no field names or item ids to describe; the status badge is
    // the whole story for a release.
    if (entry.origin === "openshell" && entry.status === AgentAccessRequestStatus.Shared) {
      return undefined;
    }
    switch (entry.status) {
      case AgentAccessRequestStatus.Shared: {
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
