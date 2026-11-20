import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, FormRecord, ReactiveFormsModule } from "@angular/forms";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  IconModule,
  RadioButtonModule,
  SpinnerLockupComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { DarkImageSourceDirective } from "@bitwarden/vault";

import {
  SshAgentSetupApplyResult,
  SshAgentSetupEnvironment,
  SshAgentSetupMode,
  SshAgentSetupPlan,
  SshAgentSetupStepStatus,
  SshAgentVerifyResult,
} from "../../../autofill/models/ssh-agent-setup";

import { SshAgentSetupDetailsComponent } from "./ssh-agent-setup-details.component";
import { SshAgentSetupGuidedComponent } from "./ssh-agent-setup-guided.component";
import {
  isConflictStep,
  isSelectedByDefault,
  isToggleableStep,
  SshAgentSetupPreviewComponent,
} from "./ssh-agent-setup-preview.component";
import {
  SSH_AGENT_HELP_URL,
  toAgentProblemView,
  toVerifyFailedView,
  toVerifyView,
} from "./ssh-agent-setup-text";
import { SshAgentSetupVerifyComponent } from "./ssh-agent-setup-verify.component";
import { SshAgentSetupClient } from "./ssh-agent-setup.client";

export const SshAgentSetupStartAt = Object.freeze({
  Connect: "connect",
  Verify: "verify",
} as const);
export type SshAgentSetupStartAt = (typeof SshAgentSetupStartAt)[keyof typeof SshAgentSetupStartAt];

export interface SshAgentSetupDialogData {
  /** Open straight on the check, for example from "Check again" in Settings. */
  startAt?: SshAgentSetupStartAt;
}

/** Which SSH agent the user wants when another one is already set up. */
export const SshAgentChoice = Object.freeze({
  Bitwarden: "bitwarden",
  Current: "current",
} as const);
export type SshAgentChoice = (typeof SshAgentChoice)[keyof typeof SshAgentChoice];

export const SshAgentSetupView = Object.freeze({
  Intro: "intro",
  Loading: "loading",
  LoadError: "load-error",
  AgentProblem: "agent-problem",
  Choose: "choose",
  Applying: "applying",
  Result: "result",
} as const);
export type SshAgentSetupView = (typeof SshAgentSetupView)[keyof typeof SshAgentSetupView];

type LoadTarget = "intro" | "choose" | "verify";

/**
 * Guided, consented, verified and reversible SSH agent setup, as views that replace each other in
 * one dialog: an intro, one decision screen (what will change, with the exact lines on request),
 * progress, and a single result. Nothing is changed until the user selects Set up.
 */
@Component({
  selector: "app-ssh-agent-setup-dialog",
  templateUrl: "ssh-agent-setup-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CalloutModule,
    DarkImageSourceDirective,
    DialogModule,
    I18nPipe,
    IconModule,
    RadioButtonModule,
    ReactiveFormsModule,
    SpinnerLockupComponent,
    SshAgentSetupDetailsComponent,
    SshAgentSetupGuidedComponent,
    SshAgentSetupPreviewComponent,
    SshAgentSetupVerifyComponent,
    TypographyModule,
  ],
})
export class SshAgentSetupDialogComponent {
  private readonly client = inject(SshAgentSetupClient);
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly data = inject<SshAgentSetupDialogData | null>(DIALOG_DATA, { optional: true });
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly View = SshAgentSetupView;
  /** Relative to the renderer document, like the new experience dialog images. */
  protected readonly introLightImgSrc = "images/ssh-agent-setup/ssh-agent-intro.light.png";
  protected readonly introDarkImgSrc = "images/ssh-agent-setup/ssh-agent-intro.dark.png";

  private readonly loadTarget = signal<LoadTarget>(
    this.data?.startAt === SshAgentSetupStartAt.Verify ? "verify" : "intro",
  );

  protected readonly view = signal<SshAgentSetupView>(SshAgentSetupView.Loading);
  protected readonly environment = signal<SshAgentSetupEnvironment | null>(null);
  protected readonly plan = signal<SshAgentSetupPlan | null>(null);

  protected readonly agentProblem = computed(() => {
    const environment = this.environment();
    return environment == null ? null : toAgentProblemView(environment);
  });
  protected readonly checkingAgent = signal(false);

  /**
   * Shown when another SSH agent is already set up. Bitwarden is the default, which selects the
   * conflicting steps along with the safe ones.
   */
  protected readonly choiceForm = new FormGroup({
    agent: new FormControl<SshAgentChoice>(SshAgentChoice.Bitwarden, { nonNullable: true }),
  });
  protected readonly choice = signal<SshAgentChoice>(SshAgentChoice.Bitwarden);
  protected readonly Choice = SshAgentChoice;

  /** One control per step the user can choose, keyed by step id. Driven by the choice above. */
  protected readonly selection = new FormRecord<FormControl<boolean>>({});
  private readonly selectionValue = signal<Record<string, boolean>>({});
  protected readonly selectedStepIds = computed(() =>
    Object.entries(this.selectionValue())
      .filter(([, selected]) => selected)
      .map(([id]) => id),
  );

  protected readonly busyPhase = signal<"applying" | "checking">("checking");
  protected readonly applyResults = signal<Record<string, SshAgentSetupApplyResult>>({});
  protected readonly applyFailed = signal(false);
  protected readonly retryApply = signal(false);

  protected readonly verifyResult = signal<SshAgentVerifyResult | null>(null);
  protected readonly verifyThrew = signal(false);
  protected readonly resultView = computed(() => {
    const result = this.verifyResult();
    const environment = this.environment();
    return this.verifyThrew() || result == null || environment == null
      ? toVerifyFailedView()
      : toVerifyView(result, environment);
  });

  protected readonly guided = computed(() => this.environment()?.mode === SshAgentSetupMode.Guided);

  private readonly toggleableSteps = computed(() =>
    (this.plan()?.steps ?? []).filter((step) => isToggleableStep(step)),
  );
  private readonly conflictSteps = computed(() =>
    this.toggleableSteps().filter((step) => isConflictStep(step)),
  );

  /** Another SSH agent is set up, so the user chooses which one to use. */
  protected readonly hasConflict = computed(() => this.conflictSteps().length > 0);

  protected readonly keepCurrent = computed(
    () => this.hasConflict() && this.choice() === SshAgentChoice.Current,
  );

  /** Nothing is selected, so the primary button closes instead of applying. */
  protected readonly nothingToChange = computed(() => this.selectedStepIds().length === 0);
  protected readonly showNothingToChangeHint = computed(
    () => this.keepCurrent() && this.nothingToChange(),
  );

  static open(dialogService: DialogService, data: SshAgentSetupDialogData = {}) {
    return dialogService.open<void, SshAgentSetupDialogData>(SshAgentSetupDialogComponent, {
      data,
    });
  }

  constructor() {
    this.selection.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.selectionValue.set(this.selection.getRawValue()));
    this.choiceForm.controls.agent.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((choice) => this.onChoiceChange(choice));
    void this.load();
  }

  protected async load(): Promise<void> {
    this.goTo(SshAgentSetupView.Loading);
    try {
      const [environment, plan] = await Promise.all([
        this.client.getEnvironment(),
        this.client.getPlan(),
      ]);
      this.environment.set(environment);
      this.setPlan(plan);
    } catch {
      this.goTo(SshAgentSetupView.LoadError);
      return;
    }

    if (this.loadTarget() === "verify") {
      void this.runVerify();
    } else if (this.loadTarget() === "intro") {
      this.goTo(SshAgentSetupView.Intro);
    } else {
      this.goToChoose();
    }
  }

  /** Leaves the intro. Nothing is changed until the user consents on the next view. */
  protected startSetup(): void {
    this.goToChoose();
  }

  protected async recheckAgent(): Promise<void> {
    this.checkingAgent.set(true);
    try {
      this.environment.set(await this.client.getEnvironment());
    } catch {
      // Keep showing the last known problem; it already asks the user to try again.
    } finally {
      this.checkingAgent.set(false);
    }
    if (this.agentProblem() == null) {
      this.goTo(SshAgentSetupView.Choose);
    }
  }

  protected async apply(): Promise<void> {
    const plan = this.plan();
    if (plan == null || this.view() !== SshAgentSetupView.Choose) {
      return;
    }
    const stepIds = this.selectedStepIds();
    if (stepIds.length === 0) {
      return;
    }

    this.busyPhase.set("applying");
    this.goTo(SshAgentSetupView.Applying);
    this.applyFailed.set(false);
    this.retryApply.set(false);
    this.applyResults.set({});
    try {
      const results = await this.client.apply(plan.planId, stepIds);
      const failures = results.filter(
        (result) => result.errorCode != null || result.status === SshAgentSetupStepStatus.Failed,
      );

      if (failures.length === 0) {
        await this.runVerify();
        return;
      }

      const displayPaths = new Map(plan.steps.map((step) => [step.id, step.displayPath]));
      const expired = failures.some(
        (result) =>
          result.errorCode === "changed-since-preview" || result.errorCode === "plan-expired",
      );
      this.applyResults.set(
        Object.fromEntries(
          failures.map((result) => [
            result.stepId,
            {
              ...result,
              errorCode:
                result.errorCode === "plan-expired" ? "changed-since-preview" : result.errorCode,
              displayPath: result.displayPath ?? displayPaths.get(result.stepId),
            },
          ]),
        ),
      );

      if (expired) {
        // The files no longer match what the user reviewed. Show the new changes instead.
        this.setPlan(await this.client.getPlan());
      } else {
        const statusById = new Map(results.map((result) => [result.stepId, result.status]));
        this.setPlan({
          ...plan,
          steps: plan.steps.map((step) => ({
            ...step,
            status: statusById.get(step.id) ?? step.status,
          })),
        });
        this.retryApply.set(failures.some((result) => result.errorCode !== "blocked"));
      }
    } catch {
      this.applyFailed.set(true);
      this.retryApply.set(true);
    }
    this.goTo(SshAgentSetupView.Choose);
  }

  /** The primary button on the choose view: apply, or close when there is nothing to apply. */
  protected async primary(): Promise<void> {
    if (this.nothingToChange()) {
      await this.close();
    } else {
      await this.apply();
    }
  }

  /** The user ran the commands themselves, so check the result. */
  protected async confirmGuided(): Promise<void> {
    await this.runVerify();
  }

  protected async runVerify(): Promise<void> {
    this.busyPhase.set("checking");
    this.goTo(SshAgentSetupView.Applying);
    this.verifyThrew.set(false);
    try {
      this.verifyResult.set(await this.client.verify());
    } catch {
      this.verifyThrew.set(true);
    }
    this.goTo(SshAgentSetupView.Result);
  }

  /** Returns to the choose view with fresh files, for example when the check found it isn't connected. */
  protected async changeSetup(): Promise<void> {
    this.loadTarget.set("choose");
    this.applyResults.set({});
    this.applyFailed.set(false);
    this.retryApply.set(false);
    await this.load();
  }

  protected openHelp(): void {
    this.platformUtilsService.launchUri(SSH_AGENT_HELP_URL);
  }

  protected async close(): Promise<void> {
    await this.dialogRef.close();
  }

  /** Bitwarden selects the conflicting steps with the safe ones; keeping the current agent clears them. */
  private onChoiceChange(choice: SshAgentChoice): void {
    this.choice.set(choice);
    for (const step of this.conflictSteps()) {
      this.selection.controls[step.id]?.setValue(choice === SshAgentChoice.Bitwarden);
    }
  }

  private goToChoose(): void {
    this.goTo(
      this.agentProblem() != null ? SshAgentSetupView.AgentProblem : SshAgentSetupView.Choose,
    );
  }

  /** Shows a view and moves focus to its heading so keyboard and screen reader users land on it. */
  private goTo(view: SshAgentSetupView): void {
    this.view.set(view);
    afterNextRender(
      () => {
        this.elementRef.nativeElement.querySelector<HTMLElement>("[data-view-heading]")?.focus();
      },
      { injector: this.injector },
    );
  }

  private setPlan(plan: SshAgentSetupPlan): void {
    for (const id of Object.keys(this.selection.controls)) {
      this.selection.removeControl(id, { emitEvent: false });
    }
    for (const step of plan.steps) {
      if (isToggleableStep(step)) {
        this.selection.addControl(
          step.id,
          new FormControl(
            isConflictStep(step)
              ? this.choice() === SshAgentChoice.Bitwarden
              : isSelectedByDefault(step),
            { nonNullable: true },
          ),
          { emitEvent: false },
        );
      }
    }
    this.selectionValue.set(this.selection.getRawValue());
    this.plan.set(plan);
  }
}
