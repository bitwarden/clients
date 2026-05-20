// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
  input,
  output,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule } from "@angular/forms";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  ButtonModule,
  CardComponent,
  CopyClickDirective,
  FormFieldModule,
  ItemModule,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
    I18nPipe,
    CopyClickDirective,
    ButtonModule,
    CardComponent,
  ],
})
export class SendFormComponent implements AfterViewInit {
  private readonly bitSubmit = viewChild.required(BitSubmitDirective);

  /** The form ID to use for the form. Used to connect it to a submit button. */
  readonly formId = input.required<string>();

  /**
   * The configuration for the add/edit form. Used to determine which controls are shown and what values are available.
   */
  readonly config = input.required<SendFormConfig>();

  /** Optional submit button that will be disabled or marked as loading when the form is submitting. */
  readonly submitBtn = input<ButtonComponent>();

  protected readonly editing = input<boolean>();
  private readonly environment = toSignal(this.envService.environment$);
  protected readonly sendLink = computed(() => {
    return (
      this.environment().getSendUrl() +
      this.sendFormService.originalSendView()?.accessId +
      "/" +
      this.sendFormService.originalSendView()?.urlB64Key
    );
  });

  /** Event emitted when the send is created successfully. */
  readonly onSendCreated = output<SendView>();

  /** Event emitted when the send is updated successfully. */
  readonly onSendUpdated = output<SendView>();

  /** Event emitted when the user requests to open the password generator. */
  readonly openPasswordGenerator = output<void>();

  readonly sendDetailsComponent = viewChild(SendDetailsComponent);

  protected loading: boolean = true;

  SendType = SendType;

  constructor(
    protected sendFormService: SendFormService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private destroyRef: DestroyRef,
    private envService: EnvironmentService,
  ) {
    // We need to reinitialize the form any time the config input changes
    effect(() => {
      const config = this.config();
      if (config) {
        void this.init();
      }
    });
  }

  ngAfterViewInit(): void {
    this.bitSubmit()
      .loading$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading) => {
        this.submitBtn()?.loading.set(loading);
      });
    this.bitSubmit()
      .disabled$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((disabled) => {
        this.submitBtn()?.disabled.set(disabled);
      });
  }

  async init() {
    this.loading = true;
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
    this.onSendUpdated.emit(sendView);
  };
}
