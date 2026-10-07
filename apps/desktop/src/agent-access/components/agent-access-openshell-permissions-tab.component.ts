import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import {
  BadgeComponent,
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  MenuModule,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  OpenShellManagementError,
  OpenShellProfileEndpoint,
  OpenShellProviderProfile,
  OpenShellSandboxCredential,
} from "../models/openshell-management";
import {
  findOpenShellPermissionUsage,
  OpenShellPermissionUsage,
} from "../utils/openshell-permission-usage.util";
import {
  describeOpenShellPrograms,
  OpenShellProgramDisplay,
} from "../utils/openshell-program-catalog.util";

import { AgentAccessOpenShellPermissionDialogComponent } from "./agent-access-openshell-permission-dialog.component";
import { AgentAccessOpenShellProgramIconComponent } from "./agent-access-openshell-program-icon.component";

interface PermissionRow {
  /** Profile id. */
  id: string;
  /** Profile display name, falling back to its id. */
  name: string;
  /** The full profile, when the gateway lists it; a credential's unknown profile has none. */
  profile: OpenShellProviderProfile | null;
  editable: boolean;
  /** Env vars this sandbox's secrets use this permission as. */
  envVars: string[];
  endpoints: OpenShellProfileEndpoint[];
  programs: OpenShellProgramDisplay[];
  /** Sandboxes using it (all of them, not only this one). */
  usedBy: string[];
}

/**
 * "Permissions" tab of a sandbox: the permissions on the gateway, i.e. where a secret may be sent,
 * with what access and from which programs. A permission is shared by every sandbox that uses it,
 * so each row says which do, and the ones this app created (custom) can be edited, created or
 * deleted here. A permission still in use can't be deleted. Everything shown is a name, a host or a
 * path; never a value.
 */
@Component({
  selector: "app-agent-access-openshell-permissions-tab",
  templateUrl: "agent-access-openshell-permissions-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAccessOpenShellProgramIconComponent,
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    I18nPipe,
    IconButtonModule,
    MenuModule,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellPermissionsTabComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);

  protected readonly name = toSignal(
    this.route.parent.paramMap.pipe(map((params) => params.get("name"))),
    { initialValue: this.route.parent.snapshot.paramMap.get("name") },
  );

  protected readonly loading = signal(true);
  protected readonly rows = signal<PermissionRow[]>([]);
  protected readonly failure = signal<{ error: OpenShellManagementError; message?: string } | null>(
    null,
  );
  protected readonly actionFailure = signal<string | null>(null);
  /** `false` when some sandbox couldn't be read, so "not in use" can't be trusted. */
  protected readonly usageComplete = signal(true);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected canDelete(row: PermissionRow): boolean {
    return row.editable && this.usageComplete() && row.usedBy.length === 0;
  }

  protected async openNew(): Promise<void> {
    const ref = AgentAccessOpenShellPermissionDialogComponent.open(this.dialogService, {
      existingIds: this.rows().map((row) => row.id),
    });
    if ((await firstValueFrom(ref.closed)) === true) {
      await this.load();
    }
  }

  protected async edit(row: PermissionRow): Promise<void> {
    if (row.profile == null) {
      return;
    }
    const ref = AgentAccessOpenShellPermissionDialogComponent.open(this.dialogService, {
      profile: row.profile,
    });
    if ((await firstValueFrom(ref.closed)) === true) {
      await this.load();
    }
  }

  protected async delete(row: PermissionRow): Promise<void> {
    if (!this.canDelete(row)) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsPermDeleteTitle" },
      content: { key: "agentAccessOsPermDeleteContent", placeholders: [row.name] },
      type: "danger",
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });
    if (!confirmed) {
      return;
    }
    this.actionFailure.set(null);
    const result = await ipc.agentAccess.deleteOpenShellProfile({ id: row.id });
    if (!result.ok) {
      this.actionFailure.set(result.message?.trim() || row.name);
    }
    await this.load();
  }

  private async load(): Promise<void> {
    const sandbox = this.name();
    const [credentials, profiles, usage] = await Promise.all([
      ipc.agentAccess.listOpenShellCredentials({ sandboxName: sandbox }),
      ipc.agentAccess.listOpenShellProfiles(),
      findOpenShellPermissionUsage(),
    ]);
    if (!credentials.ok) {
      this.failure.set({ error: credentials.error, message: credentials.message });
    } else if (!profiles.ok) {
      this.failure.set({ error: profiles.error, message: profiles.message });
    } else {
      this.failure.set(null);
      this.usageComplete.set(usage?.complete === true);
      this.rows.set(toRows(profiles.data, credentials.data, usage));
    }
    this.loading.set(false);
  }
}

function toRows(
  profiles: OpenShellProviderProfile[],
  credentials: OpenShellSandboxCredential[],
  usage: OpenShellPermissionUsage | null,
): PermissionRow[] {
  const envVarsFor = (id: string) =>
    credentials.filter((c) => c.profileId === id).flatMap((c) => c.bindings.map((b) => b.envVar));
  const usedBy = (id: string) => usage?.sandboxesByProfile.get(id) ?? [];

  const rows: PermissionRow[] = profiles.map((profile) => ({
    id: profile.id,
    name: profile.displayName || profile.id,
    profile,
    editable: profile.editable === true,
    envVars: envVarsFor(profile.id),
    endpoints: profile.endpoints,
    programs: describeOpenShellPrograms(profile.binaries ?? []),
    usedBy: usedBy(profile.id),
  }));

  // A credential can name a profile the gateway no longer lists: still show it, read-only.
  const known = new Set(profiles.map((p) => p.id));
  for (const id of new Set(credentials.map((c) => c.profileId))) {
    if (id != null && !known.has(id)) {
      rows.push({
        id,
        name: id,
        profile: null,
        editable: false,
        envVars: envVarsFor(id),
        endpoints: [],
        programs: [],
        usedBy: usedBy(id),
      });
    }
  }
  return rows;
}
