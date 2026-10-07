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

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  isOpenShellBinaryPath,
  isOpenShellEndpointHost,
  isOpenShellEnvVarName,
  isOpenShellPort,
  isOpenShellResourceName,
  OpenShellEndpointAccess,
  OpenShellManagementError,
  OpenShellPermissionEndpoint,
  OpenShellProviderProfile,
} from "../models/openshell-management";
import { findOpenShellPermissionUsage } from "../utils/openshell-permission-usage.util";
import {
  findOpenShellProgram,
  OPENSHELL_PROGRAMS,
  pathsToSelection,
  programsToPaths,
} from "../utils/openshell-program-catalog.util";

import { AgentAccessOpenShellProgramIconComponent } from "./agent-access-openshell-program-icon.component";

const DEFAULT_PORT = "443";
const ProgramMode = Object.freeze({ Any: "any", Only: "only" } as const);
type ProgramMode = (typeof ProgramMode)[keyof typeof ProgramMode];
const MAX_ID_CHARS = 40;

export interface AgentAccessOpenShellPermissionDialogParams {
  /** Edit this custom permission; omitted to create a new one. */
  profile?: OpenShellProviderProfile;
  /** Ids already taken, to catch a clash before asking the gateway. */
  existingIds?: string[];
  /** Create a new permission starting from a blocked request (§M8.20 rule 16): the host, port and
   *  program the agent tried to use. Ignored when editing. Validated like typed input. */
  prefill?: { host: string; port: number; program?: string };
}

interface HostRow {
  key: number;
  host: WritableSignal<string>;
  port: WritableSignal<string>;
  access: WritableSignal<OpenShellEndpointAccess>;
}

interface Issue {
  key: string;
  args: string[];
}

/** `GitHub (work)` becomes `github-work`. */
export function slugifyPermissionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_CHARS)
    .replace(/-+$/g, "");
}

/** `github-work` becomes `GITHUB_WORK_TOKEN`; empty when nothing usable is left. */
export function defaultPermissionEnvVar(name: string): string {
  const slug = slugifyPermissionName(name).replace(/-/g, "_").toUpperCase();
  if (slug === "") {
    return "";
  }
  return `${/^[0-9]/.test(slug) ? "_" : ""}${slug}_TOKEN`;
}

/**
 * Creates or edits a permission (an OpenShell provider profile): the hosts a secret may be sent to,
 * the access it has there and the programs allowed to use it (agent-access-architecture.md,
 * §M8.20 rule 14). A permission is shared by every sandbox that uses it, so editing shows which
 * sandboxes are affected, and an edit that lets a secret go further asks to be confirmed first.
 *
 * Only ids, names, hosts, ports and program paths pass through here; never a secret value.
 */
@Component({
  selector: "app-agent-access-openshell-permission-dialog",
  templateUrl: "agent-access-openshell-permission-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAccessOpenShellProgramIconComponent,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    ReactiveFormsModule,
    TableModule,
    ToggleGroupModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellPermissionDialogComponent implements OnInit {
  private readonly params = inject<AgentAccessOpenShellPermissionDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);

  /** `bitSubmit` needs a form; the fields are plain signals. */
  protected readonly form = new FormGroup({});

  protected readonly editing = this.params.profile ?? null;

  protected readonly displayName = signal(this.editing?.displayName ?? "");
  protected readonly description = signal(this.editing?.description ?? "");
  protected readonly id = signal(this.editing?.id ?? "");
  protected readonly envVar = signal("");
  protected readonly ProgramMode = ProgramMode;
  protected readonly catalog = OPENSHELL_PROGRAMS;
  /** Empty saved programs means any program can use the secret. */
  private readonly saved = pathsToSelection(this.editing?.binaries ?? []);
  protected readonly programMode = signal<ProgramMode>(
    this.editing != null && (this.editing.binaries ?? []).length > 0
      ? ProgramMode.Only
      : ProgramMode.Any,
  );
  protected readonly selectedPrograms = signal<string[]>(this.saved.ids);
  protected readonly customPrograms = signal<string[]>(this.saved.custom);
  protected readonly customInput = signal("");
  protected readonly customInvalid = signal(false);
  protected readonly hosts = signal<HostRow[]>([]);

  protected readonly showIssues = signal(false);
  protected readonly submitFailure = signal<{
    error: OpenShellManagementError;
    message?: string;
  } | null>(null);
  /** `null` while loading; the sandboxes (by name) using this permission. */
  protected readonly affected = signal<string[] | null>(null);
  protected readonly affectedUnknown = signal(false);

  private readonly edited = { id: false, envVar: false, nextKey: 0 };

  /** The paths to save: none for "any program". A program kept from before keeps the paths it had. */
  protected readonly programs = computed(() => {
    if (this.programMode() === ProgramMode.Any) {
      return [];
    }
    const before = this.editing?.binaries ?? [];
    const kept = this.selectedPrograms().filter((id) => this.saved.ids.includes(id));
    const added = this.selectedPrograms().filter((id) => !this.saved.ids.includes(id));
    const keptPaths = kept.flatMap((id) =>
      (findOpenShellProgram(id)?.paths ?? []).filter((path) => before.includes(path)),
    );
    return [...new Set([...keptPaths, ...programsToPaths(added, []), ...this.customPrograms()])];
  });

  protected readonly anyProgram = computed(() => this.programMode() === ProgramMode.Any);

  protected readonly issues = computed<Issue[]>(() => {
    const found: Issue[] = [];
    if (this.displayName().trim() === "") {
      found.push({ key: "agentAccessOsPermIssueName", args: [] });
    }
    if (this.editing == null) {
      if (!isOpenShellResourceName(this.id())) {
        found.push({ key: "agentAccessOsPermIssueId", args: [] });
      } else if ((this.params.existingIds ?? []).includes(this.id())) {
        found.push({ key: "agentAccessOsPermIssueIdTaken", args: [this.id()] });
      }
      if (!isOpenShellEnvVarName(this.envVar())) {
        found.push({ key: "agentAccessOsPermIssueEnvVar", args: [] });
      }
    }
    const rows = this.hosts();
    if (rows.length === 0) {
      found.push({ key: "agentAccessOsPermIssueNoHosts", args: [] });
    }
    const seen = new Set<string>();
    for (const row of rows) {
      const host = row.host().trim();
      if (!isOpenShellEndpointHost(host)) {
        found.push({ key: "agentAccessOsPermIssueHost", args: [host] });
      }
      if (!isOpenShellPort(Number(row.port()))) {
        found.push({ key: "agentAccessOsPermIssuePort", args: [host] });
      }
      const pair = `${host.toLowerCase()}:${row.port().trim()}`;
      if (seen.has(pair)) {
        found.push({ key: "agentAccessOsPermIssueDuplicateHost", args: [host] });
      }
      seen.add(pair);
    }
    if (this.programMode() === ProgramMode.Only && this.programs().length === 0) {
      found.push({ key: "agentAccessOsPermIssueNoPrograms", args: [] });
    }
    for (const program of this.programs()) {
      if (!isOpenShellBinaryPath(program)) {
        found.push({ key: "agentAccessOsPermIssueProgram", args: [program] });
      }
    }
    return found;
  });

  static open(dialogService: DialogService, params: AgentAccessOpenShellPermissionDialogParams) {
    return dialogService.open<boolean, AgentAccessOpenShellPermissionDialogParams>(
      AgentAccessOpenShellPermissionDialogComponent,
      { data: params },
    );
  }

  ngOnInit(): void {
    const endpoints = this.editing?.endpoints ?? [];
    const prefill = this.editing == null ? this.params.prefill : undefined;
    this.hosts.set(
      endpoints.length > 0
        ? endpoints.map((e) => this.newRow(e.host, String(e.port), e.access))
        : prefill != null
          ? [this.newRow(prefill.host, String(prefill.port), undefined)]
          : [this.newRow("", DEFAULT_PORT, undefined)],
    );
    if (prefill != null) {
      this.setName(prefill.host);
      if (prefill.program != null && isOpenShellBinaryPath(prefill.program)) {
        const selection = pathsToSelection([prefill.program]);
        this.programMode.set(ProgramMode.Only);
        this.selectedPrograms.set(selection.ids);
        this.customPrograms.set(selection.custom);
      }
    }
    if (this.editing != null) {
      void this.loadAffected(this.editing.id);
    }
  }

  protected errorKey(error: OpenShellManagementError): string {
    switch (error) {
      case "cliMissing":
        return "agentAccessOsCredErrorCliMissing";
      case "gatewayUnreachable":
        return "agentAccessOsCredErrorGatewayUnreachable";
      case "unsupported":
        return "agentAccessOsCredErrorUnsupported";
      case "alreadyExists":
        return "agentAccessOsPermErrorAlreadyExists";
      default:
        return "agentAccessOsCredErrorFailed";
    }
  }

  protected setName(name: string): void {
    this.displayName.set(name);
    if (this.editing == null) {
      if (!this.edited.id) {
        this.id.set(slugifyPermissionName(name));
      }
      if (!this.edited.envVar) {
        this.envVar.set(defaultPermissionEnvVar(name));
      }
    }
  }

  protected setId(id: string): void {
    this.edited.id = true;
    this.id.set(id.trim());
  }

  protected setEnvVar(envVar: string): void {
    this.edited.envVar = true;
    this.envVar.set(envVar.trim());
  }

  protected addHost(): void {
    this.hosts.set([...this.hosts(), this.newRow("", DEFAULT_PORT, undefined)]);
  }

  protected removeHost(row: HostRow): void {
    this.hosts.set(this.hosts().filter((r) => r !== row));
  }

  protected setAccess(row: HostRow, access: string): void {
    row.access.set(access === "read-write" ? "read-write" : "read-only");
  }

  protected isProgramSelected(id: string): boolean {
    return this.selectedPrograms().includes(id);
  }

  protected toggleProgram(id: string, checked: boolean): void {
    const without = this.selectedPrograms().filter((selected) => selected !== id);
    this.selectedPrograms.set(checked ? [...without, id] : without);
  }

  protected setCustomInput(value: string): void {
    this.customInput.set(value);
    this.customInvalid.set(false);
  }

  protected addCustomProgram(): void {
    const path = this.customInput().trim();
    if (path === "") {
      return;
    }
    if (!isOpenShellBinaryPath(path)) {
      this.customInvalid.set(true);
      return;
    }
    if (!this.customPrograms().includes(path)) {
      this.customPrograms.set([...this.customPrograms(), path]);
    }
    this.customInput.set("");
    this.customInvalid.set(false);
  }

  protected removeCustomProgram(path: string): void {
    this.customPrograms.set(this.customPrograms().filter((p) => p !== path));
  }

  protected close(): void {
    void this.dialogRef.close(false);
  }

  protected readonly submit = async () => {
    this.submitFailure.set(null);
    if (this.issues().length > 0) {
      this.showIssues.set(true);
      return;
    }
    const endpoints = this.endpoints();
    const base = {
      displayName: this.displayName().trim(),
      description: this.description().trim(),
      endpoints,
      binaries: this.programs(),
    };

    if (this.editing != null) {
      const widened = this.widenings(endpoints);
      if (widened.length > 0 && !(await this.confirmWidening(widened))) {
        return;
      }
      const result = await ipc.agentAccess.updateOpenShellProfile({ id: this.editing.id, ...base });
      if (!result.ok) {
        this.submitFailure.set({ error: result.error, message: result.message });
        return;
      }
    } else {
      const result = await ipc.agentAccess.createOpenShellProfile({
        id: this.id(),
        credentialEnvVar: this.envVar(),
        ...base,
      });
      if (!result.ok) {
        this.submitFailure.set({ error: result.error, message: result.message });
        return;
      }
    }
    void this.dialogRef.close(true);
  };

  private endpoints(): OpenShellPermissionEndpoint[] {
    return this.hosts().map((row) => ({
      host: row.host().trim(),
      port: Number(row.port()),
      access: row.access(),
    }));
  }

  /**
   * What this edit lets a secret do that it could not before: a new host, more access on a host,
   * or more programs. Narrowing never needs a confirmation.
   */
  private widenings(next: OpenShellPermissionEndpoint[]): string[] {
    const before = this.editing?.endpoints ?? [];
    const lines: string[] = [];
    for (const endpoint of next) {
      const old = before.find(
        (e) => e.host.toLowerCase() === endpoint.host.toLowerCase() && e.port === endpoint.port,
      );
      const where = `${endpoint.host}:${endpoint.port}`;
      if (old == null) {
        lines.push(this.i18nService.t("agentAccessOsPermWidenHost", where));
      } else if (endpoint.access === "read-write" && old.access !== "read-write") {
        // An endpoint with no recorded access counts as narrower: unknown is not a safe baseline.
        lines.push(this.i18nService.t("agentAccessOsPermWidenAccess", where));
      }
    }
    const oldPrograms = this.editing?.binaries ?? [];
    if (oldPrograms.length > 0 && this.programMode() === ProgramMode.Any) {
      lines.push(this.i18nService.t("agentAccessOsPermWidenAnyProgram"));
    } else if (oldPrograms.length > 0) {
      // Compared by program, not by path: keeping curl is not a widening even if the catalog knows
      // a second location for it. Names are shown where the catalog has one.
      for (const id of this.selectedPrograms().filter((i) => !this.saved.ids.includes(i))) {
        const name = findOpenShellProgram(id)?.name ?? id;
        lines.push(this.i18nService.t("agentAccessOsPermWidenProgram", name));
      }
      for (const path of this.customPrograms().filter((p) => !this.saved.custom.includes(p))) {
        lines.push(this.i18nService.t("agentAccessOsPermWidenProgram", path));
      }
    }
    return lines;
  }

  private confirmWidening(lines: string[]): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsPermWidenTitle" },
      content: {
        key: "agentAccessOsPermWidenContent",
        placeholders: [lines.join("; ")],
      },
      type: "warning",
      acceptButtonText: { key: "agentAccessOsPermWidenAccept" },
      cancelButtonText: { key: "cancel" },
    });
  }

  private newRow(
    host: string,
    port: string,
    access: OpenShellEndpointAccess | string | undefined,
  ): HostRow {
    return {
      key: this.edited.nextKey++,
      host: signal(host),
      port: signal(port),
      access: signal(access === "read-write" ? "read-write" : "read-only"),
    };
  }

  private async loadAffected(profileId: string): Promise<void> {
    const usage = await findOpenShellPermissionUsage();
    if (usage == null) {
      this.affectedUnknown.set(true);
      this.affected.set([]);
      return;
    }
    this.affectedUnknown.set(!usage.complete);
    this.affected.set(usage.sandboxesByProfile.get(profileId) ?? []);
  }
}
