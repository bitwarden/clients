// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AfterViewInit,
  Component,
  DestroyRef,
  input,
  OnChanges,
  OnInit,
  output,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule } from "@angular/forms";
import { combineLatest } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  FormFieldModule,
  ItemModule,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { SendFormConfig } from "../abstractions/send-form-config.service";
import { SendFormService } from "../abstractions/send-form.service";

import { SendDetailsComponent } from "./send-details/send-details.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-form",
  templateUrl: "./send-form.component.html",
  providers: [],
  imports: [
    AsyncActionsModule,
    TypographyModule,
    ItemModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SendDetailsComponent,
  ],
})
export class SendFormComponent implements AfterViewInit, OnInit, OnChanges {
  private readonly bitSubmit = viewChild.required(BitSubmitDirective);
  private _firstInitialized = false;

  /** The form ID to use for the form. Used to connect it to a submit button. */
  readonly formId = input.required<string>();

  /** The configuration for the add/edit form. Used to determine which controls are shown and what values are available. */
  readonly config = input.required<SendFormConfig>();

  /** Optional submit button that will be disabled or marked as loading when the form is submitting. */
  readonly submitBtn = input<ButtonComponent>();

  /** Event emitted when the send is created successfully. */
  readonly onSendCreated = output<SendView>();

  /** Event emitted when the send is updated successfully. */
  readonly onSendUpdated = output<SendView>();

  /**
   * Event emitted when the user requests to open the password generator.
   */
  readonly openPasswordGenerator = output<void>();

  readonly sendDetailsComponent = viewChild(SendDetailsComponent);

  /**
   * The original send being edited or cloned. Null for add mode.
   */
  originalSendView: SendView | null;

  /**
   * The value of the updated send. Starts as a new send and is updated
   * by child components via the `patchSend` method.
   * @protected
   */
  protected updatedSendView: SendView | null;
  protected loading: boolean = true;

  SendType = SendType;

  constructor(
    protected sendFormService: SendFormService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private destroyRef: DestroyRef,
  ) {}

  ngAfterViewInit(): void {
    if (this.submitBtn()) {
      combineLatest([this.bitSubmit().loading$, this.sendFormService.submitting])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(([submitDirectiveDisabled, formServiceLoading]) => {
          this.submitBtn().loading.set(submitDirectiveDisabled || formServiceLoading);
        });

      combineLatest([this.bitSubmit().disabled$, this.sendFormService.submitting])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(([submitDirectiveDisabled, formServiceLoading]) => {
          this.submitBtn().disabled.set(submitDirectiveDisabled || formServiceLoading);
        });
    }
  }

  /**
   * We need to re-initialize the form when the config is updated.
   */
  async ngOnChanges() {
    // Avoid re-initializing the form on the first change detection cycle.
    if (this._firstInitialized) {
      await this.init();
    }
  }

  async ngOnInit() {
    await this.init();
    this._firstInitialized = true;
  }

  async init() {
    this.loading = true;
    if (this.config() == null) {
      return;
    }
    await this.sendFormService.initializeSendForm(this.config());
    this.loading = false;
  }

  submit = async () => {
    const sendView = await this.sendFormService.submitSendForm();

    // Send form had errors or otherwise failed to submit
    if (!sendView) {
      return;
    }

    if (this.config().mode === "add") {
      this.onSendCreated.emit(sendView);
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("editedItem"),
    });
    this.onSendUpdated.emit(this.updatedSendView);
  };
}
