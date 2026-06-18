// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
import { I18nPipe } from "@bitwarden/ui-common";

import { SendPolicyService } from "../../..";
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
export class SendOptionsComponent {
  protected readonly sendFormService = inject(SendFormService);
  private readonly sendPolicyService = inject(SendPolicyService);
  private readonly i18nService = inject(I18nService);

  readonly editing = input<boolean>(false);

  readonly sendOptionsForm = new FormGroup({
    maxAccessCount: new FormControl<string>(
      this.sendFormService.updatedSendView()?.maxAccessCount?.toString() ?? "",
      [this.isIntegerValidator(), Validators.min(1)],
    ),
    accessCount: new FormControl(this.sendFormService.updatedSendView()?.accessCount ?? null),
    notes: new FormControl(this.sendFormService.updatedSendView()?.notes ?? null),
    hideEmail: new FormControl(this.sendFormService.updatedSendView()?.hideEmail ?? null),
  });

  readonly anyOptionFieldVisible = computed(
    () => this.maxAccessCountVisible() || this.hideEmailVisible() || this.privateNoteVisible(),
  );

  readonly maxAccessCountVisible = computed(
    () => this.editing() || this.sendFormService.originalSendView()?.maxAccessCount != null,
  );

  get shouldShowCount(): boolean {
    return (
      this.sendFormService.sendFormConfig.mode === "edit" &&
      this.sendOptionsForm.value.maxAccessCount !== null
    );
  }

  readonly showAccessCount = computed(
    () => this.sendFormService.originalSendView()?.maxAccessCount != null,
  );

  readonly viewsLeft = computed(() => {
    const maxAccessCount = this.sendFormService.originalSendView()?.maxAccessCount ?? 0;
    const accessCount = this.sendFormService.originalSendView()?.accessCount ?? 0;
    return (maxAccessCount - accessCount).toString();
  });

  private readonly _hideEmailDisabledByPolicy = toSignal(this.sendPolicyService.disableHideEmail$);
  readonly hideEmailVisible = computed(
    () =>
      !this._hideEmailDisabledByPolicy() &&
      (this.editing() || this.sendFormService.originalSendView()?.hideEmail),
  );

  readonly hideEmailDisabled = computed(() => !this.editing());

  readonly privateNoteVisible = computed(
    () => this.editing() || this.sendFormService.originalSendView()?.notes?.length > 0,
  );

  constructor() {
    this.sendFormService.registerChildForm("sendOptionsForm", this.sendOptionsForm);

    effect(() => {
      if (!this.editing() && this.sendFormService.originalSendView()) {
        this.sendOptionsForm.patchValue({
          maxAccessCount: this.sendFormService.originalSendView()?.maxAccessCount?.toString(),
          accessCount: this.sendFormService.originalSendView()?.accessCount,
          hideEmail: this.sendFormService.originalSendView()?.hideEmail,
          notes: this.sendFormService.originalSendView()?.notes,
        });
      }
    });

    effect(() => {
      if (this.hideEmailDisabled()) {
        this.sendOptionsForm.get("hideEmail").disable({ emitEvent: false });
      } else {
        this.sendOptionsForm.get("hideEmail").enable({ emitEvent: false });
      }
    });

    this.sendOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const value = this.sendOptionsForm.getRawValue();
      this.sendFormService.patchSend((send) => {
        return Object.assign(send, {
          maxAccessCount: value.maxAccessCount === "" ? null : Number(value.maxAccessCount),
          accessCount: value.accessCount,
          hideEmail: value.hideEmail,
          notes: value.notes,
        });
      });
    });
  }

  isIntegerValidator(): ValidatorFn {
    return (control: FormControl): ValidationErrors | null => {
      if (control.value == null || control.value == "") {
        return null;
      }
      const numVal = Number.parseFloat(control.value);
      if (isNaN(numVal)) {
        return { numberValidation: { message: this.i18nService.t("numericInputError") } };
      }
      const intVal = Number.parseInt(control.value);
      if (numVal !== intVal) {
        return { numberValidation: { message: this.i18nService.t("integerInputError") } };
      }
      return null;
    };
  }
}
