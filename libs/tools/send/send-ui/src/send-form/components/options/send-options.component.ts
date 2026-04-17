// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { switchMap, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import {
  TypographyModule,
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
} from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormService } from "../../abstractions/send-form.service";

@Component({
  selector: "tools-send-options",
  templateUrl: "./send-options.component.html",
  standalone: true,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    IconButtonModule,
    I18nPipe,
    ReactiveFormsModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendOptionsComponent implements OnInit {
  private readonly policyService = inject(PolicyService);
  private readonly accountService = inject(AccountService);
  protected readonly sendFormService = inject(SendFormService);

  readonly originalSendView = input<SendView>();
  readonly editing = input<boolean>(false);

  readonly sendOptionsForm = new FormGroup({
    maxAccessCount: new FormControl(null, [Validators.min(1)]),
    accessCount: new FormControl(0),
    notes: new FormControl(""),
    hideEmail: new FormControl(false),
  });

  readonly anyOptionFieldVisible = computed(
    () => this.maxAccessCountVisible() || this.hideEmailVisible() || this.privateNoteVisible(),
  );
  private readonly sendPolicyService = inject(SendPolicyService);

  get shouldShowCount(): boolean {
    return (
      this.sendFormService.sendFormConfig.mode === "edit" &&
      this.sendOptionsForm.value.maxAccessCount !== null
    );
  }

  readonly maxAccessCountVisible = computed(
    () => this.editing() || this.originalSendView()?.maxAccessCount != null,
  );

  readonly showAccessCount = computed(() => this.originalSendView()?.maxAccessCount != null);

  readonly viewsLeft = computed(() =>
    (
      (this.originalSendView()?.maxAccessCount ?? 0) - (this.originalSendView()?.accessCount ?? 0)
    ).toString(),
  );

  readonly hideEmailVisible = computed(() => this.editing() || this.originalSendView()?.hideEmail);

  private readonly _hideEmailDisabledByPolicy = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policiesByType$(PolicyType.SendOptions, userId)),
      map((policies) => policies?.some((p) => p.data.disableHideEmail)),
      takeUntilDestroyed(),
    ),
  );
  readonly hideEmailDisabled = computed(
    () =>
      !this.editing() || (this._hideEmailDisabledByPolicy() && !this.originalSendView()?.hideEmail),
  );

  readonly privateNoteVisible = computed(
    () => this.editing() || this.originalSendView()?.notes?.length,
  );

  constructor() {
    this.sendFormService.registerChildForm("sendOptionsForm", this.sendOptionsForm);

    effect(() => {
      if (!this.editing() && this.originalSendView()) {
        this.initializeFormFromOriginal(this.originalSendView());
      }
    });

    effect(() => {
      if (this.hideEmailDisabled()) {
        this.sendOptionsForm.get("hideEmail")?.disable();
      } else {
        this.sendOptionsForm.get("hideEmail")?.enable();
      }
    });

    this.sendOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.sendFormService.patchSend((send) => {
        Object.assign(send, {
          maxAccessCount: value.maxAccessCount,
          accessCount: value.accessCount,
          hideEmail: value.hideEmail,
          notes: value.notes,
        });
        return send;
      });
    });
  }

  ngOnInit() {
    if (this.sendFormService.originalSendView) {
      this.sendOptionsForm.patchValue({
        maxAccessCount: this.sendFormService.originalSendView.maxAccessCount,
        accessCount: this.sendFormService.originalSendView.accessCount,
        hideEmail: this.sendFormService.originalSendView.hideEmail,
        notes: this.sendFormService.originalSendView.notes,
      });
    }

    if (!this.sendFormService.sendFormConfig.areSendsAllowed) {
      this.sendOptionsForm.disable();
    }
  }

  private initializeFormFromOriginal(originalSendView: SendView) {
    this.sendOptionsForm.patchValue({
      maxAccessCount: originalSendView.maxAccessCount,
      accessCount: originalSendView.accessCount,
      hideEmail: originalSendView.hideEmail,
      notes: originalSendView.notes,
    });
  }
}
