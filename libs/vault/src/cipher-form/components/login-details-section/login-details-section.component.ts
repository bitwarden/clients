// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe, NgIf } from "@angular/common";
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  Optional,
  signal,
  viewChild,
  computed,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  AsyncActionsModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  PopoverModule,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { UsernameAutocompleteComponent } from "../../../components/autocomplete/username-autocomplete.component";
import { RecentUsernamesService } from "../../../services/recent-usernames.service";
import { CipherFormGenerationService } from "../../abstractions/cipher-form-generation.service";
import { TotpCaptureService } from "../../abstractions/totp-capture.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { AutofillOptionsComponent } from "../autofill-options/autofill-options.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-login-details-section",
  templateUrl: "./login-details-section.component.html",
  imports: [
    ReactiveFormsModule,
    SectionHeaderComponent,
    TypographyModule,
    JslibModule,
    CardComponent,
    FormFieldModule,
    IconButtonModule,
    AsyncActionsModule,
    NgIf,
    PopoverModule,
    AutofillOptionsComponent,
    LinkModule,
    UsernameAutocompleteComponent,
  ],
})
export class LoginDetailsSectionComponent implements OnInit {
  EventType = EventType;

  loginDetailsForm = this.formBuilder.group({
    username: [""],
    password: [""],
    totp: [""],
  });

  readonly usernameInput = viewChild<ElementRef<HTMLInputElement>>("usernameInput");

  // State for username autocomplete functionality
  readonly showAutocompleteSuggestions = signal(false);
  readonly filteredSuggestions = signal<string[]>([]);
  readonly activeSuggestionIndex = signal(-1);
  readonly usernameFieldId = Math.random().toString(36).substring(2); // random ID to prevent browser autocomplete
  readonly autocompleteIdPrefix = `username-${this.usernameFieldId}`;
  readonly autocompleteListId = computed(() => `${this.autocompleteIdPrefix}-listbox`);
  readonly activeDescendantId = computed(() => {
    const idx = this.activeSuggestionIndex();
    return idx >= 0 ? `${this.autocompleteIdPrefix}-option-${idx}` : null;
  });
  private currentUserId: UserId | null = null;
  private usernameRequestId = 0;

  /**
   * Flag indicating whether a new password has been generated for the current form.
   */
  newPasswordGenerated: boolean;

  /**
   * Whether the TOTP field can be captured from the current tab. Only available in the browser extension and
   * when not in a popout window.
   */
  get canCaptureTotp() {
    return (
      !!this.totpCaptureService?.canCaptureTotp(window) &&
      this.loginDetailsForm.controls.totp.enabled
    );
  }

  private datePipe = inject(DatePipe);

  /**
   * A local reference to the Fido2 credentials for an existing login being edited.
   * These cannot be created in the form and thus have no form control.
   * @private
   */
  private existingFido2Credentials?: Fido2CredentialView[];

  private destroyRef = inject(DestroyRef);

  get hasPasskey(): boolean {
    return this.existingFido2Credentials != null && this.existingFido2Credentials.length > 0;
  }

  get fido2CredentialCreationDateValue(): string {
    const dateCreated = this.i18nService.t("dateCreated");
    const creationDate = this.datePipe.transform(
      this.existingFido2Credentials?.[0]?.creationDate,
      "short",
    );
    return `${dateCreated} ${creationDate}`;
  }

  get viewHiddenFields() {
    if (this.cipherFormContainer.originalCipherView) {
      return this.cipherFormContainer.originalCipherView.viewPassword;
    }
    return true;
  }

  get initialValues() {
    return this.cipherFormContainer.config.initialValues;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private generationService: CipherFormGenerationService,
    private auditService: AuditService,
    private toastService: ToastService,
    private eventCollectionService: EventCollectionService,
    private accountService: AccountService,
    @Optional() private totpCaptureService?: TotpCaptureService,
    // NOTE: RecentUsernamesService is intentionally not exported from libs/vault/src/index.ts.
    // It is used here as an internal, optional dependency to provide username autocomplete.
    @Optional() private recentUsernamesService?: RecentUsernamesService, // to load recent usernames for autocomplete
  ) {
    this.cipherFormContainer.registerChildForm("loginDetails", this.loginDetailsForm);

    this.loginDetailsForm.valueChanges
      .pipe(
        takeUntilDestroyed(),
        // getRawValue() is used as fields can be disabled when passwords are hidden
        map(() => this.loginDetailsForm.getRawValue()),
      )
      .subscribe((value) => {
        this.cipherFormContainer.patchCipher((cipher) => {
          Object.assign(cipher.login, {
            username: value.username,
            password: value.password,
            totp: value.totp?.trim(),
          } as LoginView);

          return cipher;
        });
      });
  }

  async ngOnInit() {
    // Get current user ID for encrypted storage
    try {
      const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
      this.currentUserId = activeAccount?.id ?? null;
    } catch {
      // Silently fail - user ID will be null
    }

    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      this.initFromExistingCipher(prefillCipher.login);
    } else {
      this.initNewCipher();
    }

    if (this.cipherFormContainer.config.mode === "partial-edit") {
      this.loginDetailsForm.disable();
    }

    // If the form is enabled, ensure to disable password or TOTP
    // for hidden password users
    this.cipherFormContainer.formStatusChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === "enabled") {
          if (!this.viewHiddenFields) {
            this.loginDetailsForm.controls.password.disable();
            this.loginDetailsForm.controls.totp.disable();
          }
        }
      });
  }

  private initFromExistingCipher(existingLogin: LoginView) {
    this.loginDetailsForm.patchValue({
      username: this.initialValues?.username ?? existingLogin.username,
      password: this.initialValues?.password ?? existingLogin.password,
      totp: existingLogin.totp,
    });

    if (this.cipherFormContainer.config.mode != "clone") {
      this.existingFido2Credentials = existingLogin.fido2Credentials;
    }

    if (!this.viewHiddenFields) {
      this.loginDetailsForm.controls.password.disable();
      this.loginDetailsForm.controls.totp.disable();
    }
  }

  private initNewCipher() {
    this.loginDetailsForm.patchValue({
      username: this.initialValues?.username || "",
      password: this.initialValues?.password || "",
    });
  }

  /** Logs the givin event when in edit mode */
  logVisibleEvent = async (passwordVisible: boolean, event: EventType) => {
    const { mode, originalCipher } = this.cipherFormContainer.config;

    const isEdit = ["edit", "partial-edit"].includes(mode);

    if (!passwordVisible || !isEdit || !originalCipher) {
      return;
    }

    await this.eventCollectionService.collect(
      event,
      originalCipher.id,
      false,
      originalCipher.organizationId,
    );
  };

  captureTotp = async () => {
    if (!this.canCaptureTotp) {
      return;
    }
    try {
      const totp = await this.totpCaptureService.captureTotpSecret();
      if (totp) {
        this.loginDetailsForm.controls.totp.patchValue(totp);
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("totpCaptureSuccess"),
        });
      }
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("totpCaptureError"),
      });
    }
  };

  removePasskey = async () => {
    // Fido2Credentials do not have a form control, so update directly
    this.existingFido2Credentials = null;
    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.login.fido2Credentials = null;
      return cipher;
    });
  };

  /**
   * Generate a new password and update the form.
   * TODO: Browser extension needs a means to cache the current form so values are not lost upon navigating to the generator.
   */
  generatePassword = async () => {
    const newPassword = await this.generationService.generatePassword();

    if (newPassword) {
      this.loginDetailsForm.controls.password.patchValue(newPassword);
      this.newPasswordGenerated = true;
    }
  };

  /**
   * Generate a new username and update the form.
   * TODO: Browser extension needs a means to cache the current form so values are not lost upon navigating to the generator.
   */
  generateUsername = async () => {
    const newUsername = await this.generationService.generateUsername(
      this.cipherFormContainer.website,
    );
    if (newUsername) {
      this.loginDetailsForm.controls.username.patchValue(newUsername);
    }
  };

  /**
   * Checks if the password has been exposed in a data breach using the AuditService.
   */
  checkPassword = async () => {
    const password = this.loginDetailsForm.controls.password.value;

    if (password == null || password === "") {
      return;
    }

    const matches = await this.auditService.passwordLeaked(password);

    if (matches > 0) {
      this.toastService.showToast({
        variant: "warning",
        title: null,
        message: this.i18nService.t("passwordExposed", matches.toString()),
      });
    } else {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("passwordSafe"),
      });
    }
  };

  /**
   * Show autocomplete on focus
   */
  onUsernameFocus = async () => {
    if (!this.currentUserId || !this.recentUsernamesService) {
      return;
    }

    await this.loadAndFilterUsernames("");
  };

  /**
   * Filter suggestions on input
   */
  onUsernameInput = async (event: Event) => {
    if (!this.currentUserId || !this.recentUsernamesService) {
      return;
    }

    const input = (event.target as HTMLInputElement).value.toLowerCase();
    await this.loadAndFilterUsernames(input);
  };

  /**
   * Handle selection from autocomplete
   */
  onUsernameSelected = async (username: string) => {
    this.loginDetailsForm.controls.username.setValue(username);
    this.showAutocompleteSuggestions.set(false);
    this.activeSuggestionIndex.set(-1);

    // Save selected username (encrypted) for future use
    if (this.currentUserId && this.recentUsernamesService) {
      await this.recentUsernamesService.addUsername(this.currentUserId, username);
    }

    // Blur the input to close autocomplete completely
    const inputEl = this.usernameInput();
    if (inputEl) {
      inputEl.nativeElement.blur();
    }
  };

  onUsernameBlur = () => {
    void this.persistUsernameBestEffort();
    // Hide autocomplete immediately on blur
    this.showAutocompleteSuggestions.set(false);
    this.activeSuggestionIndex.set(-1);
    this.usernameRequestId++;
  };

  onUsernameKeydown = async (event: KeyboardEvent) => {
    const suggestions = this.filteredSuggestions();

    if (!this.showAutocompleteSuggestions() || suggestions.length === 0) {
      return;
    }

    const current = this.activeSuggestionIndex();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.activeSuggestionIndex.set((current + 1) % suggestions.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.activeSuggestionIndex.set(current <= 0 ? suggestions.length - 1 : current - 1);
        break;
      case "Enter":
      case "NumpadEnter": {
        event.preventDefault();
        const indexToUse = current >= 0 ? current : 0;
        await this.onUsernameSelected(suggestions[indexToUse]);
        break;
      }
      case "Escape":
        event.preventDefault();
        this.showAutocompleteSuggestions.set(false);
        this.activeSuggestionIndex.set(-1);
        break;
      default:
        break;
    }
  };

  private setSuggestions(list: string[]) {
    this.filteredSuggestions.set(list);
    this.showAutocompleteSuggestions.set(list.length > 0);
    this.activeSuggestionIndex.set(-1);
  }

  private async loadAndFilterUsernames(query: string) {
    // sequence token to discard stale responses
    const requestId = ++this.usernameRequestId;

    if (!this.currentUserId || !this.recentUsernamesService) {
      return;
    }

    const all = await this.recentUsernamesService.getRecent(this.currentUserId, 20);

    if (requestId !== this.usernameRequestId) {
      return; // stale response
    }

    if (!query) {
      this.setSuggestions(all.slice(0, 4));
      return;
    }

    const filtered = all.filter((u) => u.toLowerCase().includes(query)).slice(0, 4);
    this.setSuggestions(filtered);
  }

  private async persistUsernameBestEffort() {
    try {
      if (!this.currentUserId || !this.recentUsernamesService) {
        return;
      }
      const value = this.loginDetailsForm.controls.username.value?.trim();
      if (!value) {
        return;
      }
      await this.recentUsernamesService.addUsername(this.currentUserId, value);
    } catch {
      // ignore persistence errors
    }
  }
}
