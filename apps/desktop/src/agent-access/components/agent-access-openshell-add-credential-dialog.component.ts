import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CredentialQueryType } from "../models/credential-query-type";
import { OpenShellSecretSet } from "../models/openshell-environments";
import {
  isOpenShellEnvVarName,
  isOpenShellVaultId,
  OpenShellManagementError,
  OpenShellProviderProfile,
  OpenShellVaultField,
  OpenShellVaultResourceType,
} from "../models/openshell-management";
import { AgentAccessSecretsService } from "../services/agent-access-secrets.service";
import {
  addOpenShellCredentialUnique,
  isSingleSecretProfile,
  slotFor,
} from "../utils/openshell-profile.util";

/** Most vault choices ever shown at once. */
const MAX_SOURCE_OPTIONS = 50;
/** Wait after typing before asking Secrets Manager (a network call per query). */
const SECRET_SEARCH_DEBOUNCE_MS = 250;
export interface AgentAccessOpenShellAddCredentialDialogParams {
  sandboxName: string;
}

/**
 * What a vault object offers: a login has a username and/or password, a Secrets Manager secret a
 * value. `fields` only lists what the object really has, so a field that is empty is never
 * offered.
 */
export interface OpenShellSourceOption {
  resourceType: OpenShellVaultResourceType;
  id: string;
  name: string;
  fields: OpenShellVaultField[];
}

/** One chosen secret and how it is shared. */
interface ChosenSecret {
  option: OpenShellSourceOption;
  field: WritableSignal<OpenShellVaultField>;
  /** The permission profile; `null` until one is picked. */
  profileId: WritableSignal<string | null>;
  envVar: WritableSignal<string>;
  /** Once the user edits the name, changing the permission no longer overwrites it. */
  envVarEdited: boolean;
}

interface ValidationIssue {
  key: string;
  args: string[];
}

/**
 * Adds secrets to one sandbox (agent-access-architecture.md, §M8.20), the way a machine account is
 * given projects: search the vault, add logins and secrets to a table, and for each choose which
 * part is shared and its permission (the provider profile: the hosts, access level and programs it
 * is limited to). One provider is created per secret.
 *
 * The vault is read here only for id, name and which fields exist. No password, username or secret
 * value is read into this component, shown, logged or sent: main builds the `bw://` references
 * from the ids and the sandbox only ever receives placeholders.
 */
@Component({
  selector: "app-agent-access-openshell-add-credential-dialog",
  templateUrl: "agent-access-openshell-add-credential-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    ReactiveFormsModule,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellAddCredentialDialogComponent implements OnInit {
  private readonly params = inject<AgentAccessOpenShellAddCredentialDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly secretsService = inject(AgentAccessSecretsService);

  protected readonly sandboxName = this.params.sandboxName;
  /** `bitSubmit` needs a form; the fields are plain signals. */
  protected readonly form = new FormGroup({});

  protected readonly profilesLoading = signal(true);
  protected readonly profiles = signal<OpenShellProviderProfile[]>([]);
  protected readonly profilesFailure = signal<{
    error: OpenShellManagementError;
    message?: string;
  } | null>(null);
  protected readonly vaultLoading = signal(true);
  private readonly logins = signal<OpenShellSourceOption[]>([]);
  private readonly secretResults = signal<OpenShellSourceOption[]>([]);

  protected readonly query = signal("");
  /** Saved sets that can be added in one go; empty when there are none or they can't be read. */
  protected readonly sets = signal<OpenShellSecretSet[]>([]);
  protected readonly selectedSetId = signal("");
  protected readonly chosen = signal<ChosenSecret[]>([]);
  protected readonly submitFailure = signal<{
    error: OpenShellManagementError;
    message?: string;
  } | null>(null);
  protected readonly showIssues = signal(false);

  private readonly userId = signal<UserId | null>(null);
  private readonly search: { timer: ReturnType<typeof setTimeout> | null; generation: number } = {
    timer: null,
    generation: 0,
  };
  /** Whether any secret was added, so closing the dialog still refreshes the list behind it. */
  private readonly state = { added: false };

  /** Profiles one secret can fill; the rest are not offered. */
  protected readonly eligibleProfiles = computed(() =>
    this.profiles().filter(isSingleSecretProfile),
  );

  /** Matching logins, then matching secrets, minus anything already chosen, at most 50 in all. */
  protected readonly results = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const taken = new Set(this.chosen().map((c) => c.option.resourceType + c.option.id));
    const secrets = this.secretResults()
      .filter((o) => !taken.has(o.resourceType + o.id))
      .slice(0, MAX_SOURCE_OPTIONS);
    const logins = this.logins()
      .filter((o) => !taken.has(o.resourceType + o.id))
      .filter((o) => needle === "" || o.name.toLowerCase().includes(needle))
      .slice(0, MAX_SOURCE_OPTIONS - secrets.length);
    return [...logins, ...secrets];
  });

  protected readonly issues = computed<ValidationIssue[]>(() => {
    const rows = this.chosen();
    const found: ValidationIssue[] = [];
    const used = new Set<string>();
    for (const row of rows) {
      const name = row.option.name;
      if (row.profileId() == null) {
        found.push({ key: "agentAccessOsCredIssueNoPermission", args: [name] });
      }
      const envVar = row.envVar();
      if (!isOpenShellEnvVarName(envVar)) {
        found.push({ key: "agentAccessOsCredIssueEnvVar", args: [name] });
      } else if (used.has(envVar)) {
        found.push({ key: "agentAccessOsCredIssueDuplicateEnvVar", args: [envVar] });
      } else {
        used.add(envVar);
      }
    }
    return found;
  });

  /** "<secret> will be available to <sandbox> as ENV_VAR, only for <hosts>". */
  protected readonly summaries = computed(() =>
    this.chosen()
      .filter((row) => row.profileId() != null && isOpenShellEnvVarName(row.envVar()))
      .map((row) => {
        const hosts = this.endpointText(row.profileId());
        // Two sentences, because the i18n service takes at most three substitutions per message.
        return `${this.i18nService.t("agentAccessOsCredSummary", row.option.name, this.sandboxName, row.envVar())} ${this.i18nService.t("agentAccessOsCredSummaryEndpoints", hosts)}`;
      }),
  );

  static open(dialogService: DialogService, params: AgentAccessOpenShellAddCredentialDialogParams) {
    return dialogService.open<boolean, AgentAccessOpenShellAddCredentialDialogParams>(
      AgentAccessOpenShellAddCredentialDialogComponent,
      { data: params },
    );
  }

  ngOnInit(): void {
    void this.loadProfiles();
    void this.loadVault();
    void this.loadSets();
    void this.searchSecrets();
  }

  protected retryProfiles(): void {
    void this.loadProfiles();
  }

  protected errorKey(error: OpenShellManagementError): string {
    switch (error) {
      case "cliMissing":
        return "agentAccessOsCredErrorCliMissing";
      case "gatewayUnreachable":
        return "agentAccessOsCredErrorGatewayUnreachable";
      case "unsupported":
        return "agentAccessOsCredErrorUnsupported";
      default:
        return "agentAccessOsCredErrorFailed";
    }
  }

  protected fieldKey(field: OpenShellVaultField): string {
    return field === "value" ? "agentAccessOsCredFieldValue" : field;
  }

  protected fieldsText(option: OpenShellSourceOption): string {
    return option.fields.map((f) => this.i18nService.t(this.fieldKey(f))).join(", ");
  }

  protected endpointText(profileId: string | null): string {
    const profile = this.profiles().find((p) => p.id === profileId);
    return (profile?.endpoints ?? []).map((e) => `${e.host}:${e.port}`).join(", ");
  }

  protected setQuery(query: string): void {
    this.query.set(query);
    if (this.search.timer != null) {
      clearTimeout(this.search.timer);
    }
    this.search.timer = setTimeout(() => {
      this.search.timer = null;
      void this.searchSecrets();
    }, SECRET_SEARCH_DEBOUNCE_MS);
  }

  protected add(option: OpenShellSourceOption): void {
    // No permission is preselected: the choice is what limits where the secret can go.
    this.chosen.set([
      ...this.chosen(),
      {
        option,
        field: signal(option.fields.includes("password") ? "password" : option.fields[0]),
        profileId: signal<string | null>(null),
        envVar: signal(""),
        envVarEdited: false,
      },
    ]);
    this.showIssues.set(false);
  }

  /**
   * Adds every secret of the chosen set as a row. The rows are ordinary rows: the permission and
   * env var can still be changed before saving. A secret already chosen is not added twice, and a
   * permission that no longer exists is left unset so the user has to pick one.
   */
  protected addSet(): void {
    const set = this.sets().find((candidate) => candidate.id === this.selectedSetId());
    if (set == null) {
      return;
    }
    const taken = new Set(this.chosen().map((c) => c.option.resourceType + c.option.id));
    const rows: ChosenSecret[] = [];
    for (const ref of set.secrets) {
      if (taken.has(ref.resourceType + ref.id)) {
        continue;
      }
      const known = this.logins().find(
        (o) => o.resourceType === ref.resourceType && o.id === ref.id,
      );
      rows.push({
        option: {
          resourceType: ref.resourceType,
          id: ref.id,
          name: ref.label,
          fields: known?.fields.includes(ref.field) ? known.fields : [ref.field],
        },
        field: signal(ref.field),
        profileId: signal<string | null>(
          this.eligibleProfiles().some((p) => p.id === ref.profileId) ? ref.profileId : null,
        ),
        envVar: signal(ref.envVar),
        envVarEdited: true,
      });
    }
    this.chosen.set([...this.chosen(), ...rows]);
    this.selectedSetId.set("");
    this.showIssues.set(false);
  }

  protected remove(row: ChosenSecret): void {
    this.chosen.set(this.chosen().filter((c) => c !== row));
  }

  protected setField(row: ChosenSecret, field: string): void {
    if (row.option.fields.includes(field as OpenShellVaultField)) {
      row.field.set(field as OpenShellVaultField);
    }
  }

  protected setProfile(row: ChosenSecret, profileId: string): void {
    row.profileId.set(profileId === "" ? null : profileId);
    if (!row.envVarEdited) {
      row.envVar.set(this.defaultEnvVar(row.profileId()));
    }
  }

  protected setEnvVar(row: ChosenSecret, envVar: string): void {
    row.envVarEdited = true;
    row.envVar.set(envVar.trim());
  }

  protected envVarInvalid(row: ChosenSecret): boolean {
    return row.envVar() !== "" && !isOpenShellEnvVarName(row.envVar());
  }

  protected close(): void {
    void this.dialogRef.close(this.state.added);
  }

  protected readonly submit = async () => {
    this.submitFailure.set(null);
    if (this.chosen().length === 0) {
      return;
    }
    if (this.issues().length > 0) {
      this.showIssues.set(true);
      return;
    }
    // One at a time, so a failure leaves a clear line between what was added and what was not.
    for (const row of [...this.chosen()]) {
      const failure = await this.addOne(row);
      if (failure != null) {
        this.submitFailure.set(failure);
        return;
      }
      this.state.added = true;
      this.chosen.set(this.chosen().filter((c) => c !== row));
    }
    void this.dialogRef.close(true);
  };

  /** Ids, field names, env var names and display labels. Nothing else goes to main. */
  private async addOne(
    row: ChosenSecret,
  ): Promise<{ error: OpenShellManagementError; message?: string } | null> {
    const profileId = row.profileId();
    if (profileId == null) {
      return null;
    }
    const result = await addOpenShellCredentialUnique({
      sandboxName: this.sandboxName,
      profileId,
      bindings: [
        {
          envVar: row.envVar(),
          resourceType: row.option.resourceType,
          id: row.option.id,
          field: row.field(),
          label: row.option.name,
        },
      ],
    });
    return result.ok ? null : { error: result.error, message: result.message };
  }

  private defaultEnvVar(profileId: string | null): string {
    const profile = this.profiles().find((p) => p.id === profileId);
    const slot = profile == null ? null : slotFor(profile);
    return slot?.envVars[0] ?? "";
  }

  /** Secret names only: `findSecrets` never fetches a value. */
  private async searchSecrets(): Promise<void> {
    const generation = ++this.search.generation;
    const userId = await this.activeUserId();
    if (userId == null) {
      return;
    }
    const matches = await this.secretsService.findSecrets(
      CredentialQueryType.Search,
      this.query().trim(),
      userId,
    );
    if (generation !== this.search.generation) {
      return;
    }
    this.secretResults.set(
      matches
        .map((m) => ({ id: m.secretId.toLowerCase(), name: m.name }))
        .filter((m) => isOpenShellVaultId(m.id))
        .map((m) => ({
          resourceType: "secret" as const,
          id: m.id,
          name: m.name,
          fields: ["value" as const],
        })),
    );
  }

  private async activeUserId(): Promise<UserId | null> {
    if (this.userId() == null) {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      this.userId.set(account?.id ?? null);
    }
    return this.userId();
  }

  /** Best effort: without sets the dialog is the plain add dialog. */
  private async loadSets(): Promise<void> {
    try {
      const result = await ipc.agentAccess.listOpenShellSecretSets();
      if (result.ok) {
        this.sets.set(result.data);
      }
    } catch {
      // Sets are optional.
    }
  }

  private async loadProfiles(): Promise<void> {
    this.profilesLoading.set(true);
    this.profilesFailure.set(null);
    const result = await ipc.agentAccess.listOpenShellProfiles();
    if (result.ok) {
      this.profiles.set(result.data);
    } else {
      this.profiles.set([]);
      this.profilesFailure.set({ error: result.error, message: result.message });
    }
    this.profilesLoading.set(false);
  }

  /**
   * Active logins, reduced at once to id, name and which fields exist. The decrypted views are not
   * kept and only the presence of a username or password is looked at, never its content.
   */
  private async loadVault(): Promise<void> {
    this.vaultLoading.set(true);
    try {
      const userId = await this.activeUserId();
      if (userId == null) {
        return;
      }
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      const options: OpenShellSourceOption[] = [];
      for (const cipher of ciphers) {
        if (cipher.type !== CipherType.Login || cipher.isDeleted || cipher.isArchived) {
          continue;
        }
        const id = cipher.id?.toLowerCase();
        const fields: OpenShellVaultField[] = [];
        if (cipher.login?.username) {
          fields.push("username");
        }
        if (cipher.login?.password) {
          fields.push("password");
        }
        if (!isOpenShellVaultId(id) || fields.length === 0) {
          continue;
        }
        options.push({ resourceType: "item", id, name: cipher.name ?? "", fields });
      }
      options.sort((a, b) => a.name.localeCompare(b.name));
      this.logins.set(options);
    } finally {
      this.vaultLoading.set(false);
    }
  }
}
