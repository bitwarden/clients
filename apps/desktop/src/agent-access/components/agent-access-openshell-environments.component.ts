import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  MenuModule,
  NoItemsModule,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OpenShellEnvironment, OpenShellSecretSet } from "../models/openshell-environments";
import { OpenShellManagementError } from "../models/openshell-management";

import { AgentAccessOpenShellEnvironmentDialogComponent } from "./agent-access-openshell-environment-dialog.component";
import { AgentAccessOpenShellSetNameDialogComponent } from "./agent-access-openshell-set-name-dialog.component";
import { AgentAccessOpenShellViewToggleComponent } from "./agent-access-openshell-view-toggle.component";

interface LoadFailure {
  error: OpenShellManagementError;
  message?: string;
}

/**
 * The "Environments" view of the OpenShell tab (agent-access-architecture.md, §M8.20 rule 17):
 * named presets for creating a sandbox (image or template, resources, secrets) and the named sets
 * of secrets they can use. Both are app-side metadata (ids and names only): nothing here talks to
 * the gateway, so the view works whenever OpenShell management does.
 *
 * Sets are created from a sandbox's Secrets tab; here they are renamed and deleted. A set an
 * environment uses cannot be deleted (main refuses, and the message is shown).
 */
@Component({
  selector: "app-agent-access-openshell-environments",
  templateUrl: "agent-access-openshell-environments.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAccessOpenShellViewToggleComponent,
    ButtonModule,
    CalloutModule,
    I18nPipe,
    IconButtonModule,
    MenuModule,
    NoItemsModule,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellEnvironmentsComponent implements OnInit {
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);

  protected readonly skeletonRows = [0, 1];
  protected readonly loading = signal(true);
  protected readonly environments = signal<OpenShellEnvironment[]>([]);
  protected readonly sets = signal<OpenShellSecretSet[]>([]);
  protected readonly failure = signal<LoadFailure | null>(null);
  /** Scrubbed text of the last failed action. */
  protected readonly actionError = signal<string | null>(null);

  protected readonly failureKey = computed(() => {
    switch (this.failure()?.error) {
      case "unsupported":
        return "agentAccessOsPageErrorUnsupported";
      default:
        return "agentAccessOsEnvErrorLoad";
    }
  });

  private readonly reads = { sequence: 0 };

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected retry(): Promise<void> {
    return this.load();
  }

  /** "Name of the set", the count of inline secrets, or nothing. */
  protected secretsText(environment: OpenShellEnvironment): string {
    if (environment.secretSetId != null) {
      return (
        this.sets().find((set) => set.id === environment.secretSetId)?.name ??
        this.i18nService.t("agentAccessOsEnvSetMissing")
      );
    }
    const count = environment.secrets?.length ?? 0;
    return count === 0 ? "" : this.i18nService.t("agentAccessOsEnvSecretsInline", count);
  }

  protected sourceText(environment: OpenShellEnvironment): string {
    return environment.from ?? environment.template ?? "";
  }

  protected resourcesText(environment: OpenShellEnvironment): string {
    return [environment.cpu, environment.memory].filter((part) => part != null).join(" / ");
  }

  protected async newEnvironment(): Promise<void> {
    await this.openDialog();
  }

  protected async edit(environment: OpenShellEnvironment): Promise<void> {
    await this.openDialog(environment);
  }

  protected async delete(environment: OpenShellEnvironment): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsEnvDeleteTitle" },
      content: { key: "agentAccessOsEnvDeleteContent", placeholders: [environment.name] },
      acceptButtonText: { key: "delete" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    this.actionError.set(null);
    const result = await ipc.agentAccess.deleteOpenShellEnvironment({ id: environment.id });
    if (!result.ok) {
      this.actionError.set(
        result.message?.trim() || this.i18nService.t("agentAccessOsEnvErrorDelete"),
      );
    }
    await this.load();
  }

  protected async renameSet(set: OpenShellSecretSet): Promise<void> {
    const ref = AgentAccessOpenShellSetNameDialogComponent.open(this.dialogService, {
      titleKey: "agentAccessOsSetRenameTitle",
      initialName: set.name,
      save: (name) =>
        ipc.agentAccess.saveOpenShellSecretSet({ id: set.id, name, secrets: set.secrets }),
    });
    if ((await firstValueFrom(ref.closed)) === true) {
      await this.load();
    }
  }

  protected async deleteSet(set: OpenShellSecretSet): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsSetDeleteTitle" },
      content: { key: "agentAccessOsSetDeleteContent", placeholders: [set.name] },
      acceptButtonText: { key: "delete" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    this.actionError.set(null);
    const result = await ipc.agentAccess.deleteOpenShellSecretSet({ id: set.id });
    if (!result.ok) {
      this.actionError.set(
        result.message?.trim() || this.i18nService.t("agentAccessOsEnvErrorDelete"),
      );
    }
    await this.load();
  }

  private async openDialog(environment?: OpenShellEnvironment): Promise<void> {
    const ref = AgentAccessOpenShellEnvironmentDialogComponent.open(this.dialogService, {
      environment,
      sets: this.sets(),
      inlineSecrets: environment?.secrets,
    });
    if ((await firstValueFrom(ref.closed)) != null) {
      await this.load();
    }
  }

  private async load(): Promise<void> {
    const sequence = ++this.reads.sequence;
    this.loading.set(true);
    const [environments, sets] = await Promise.all([
      ipc.agentAccess.listOpenShellEnvironments(),
      ipc.agentAccess.listOpenShellSecretSets(),
    ]);
    if (sequence !== this.reads.sequence) {
      return;
    }
    if (environments.ok && sets.ok) {
      this.failure.set(null);
      this.environments.set(environments.data);
      this.sets.set(sets.data);
    } else {
      const failed = environments.ok ? sets : environments;
      this.environments.set([]);
      this.sets.set([]);
      this.failure.set({ error: failed.error, message: failed.message });
    }
    this.loading.set(false);
  }
}
