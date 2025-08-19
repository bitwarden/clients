// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgIf } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType, SecureNoteType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";
import { CipherFormService } from "../abstractions/cipher-form.service";
import { CipherForm, CipherFormContainer } from "../cipher-form-container";
import { CipherFormCacheService } from "../services/default-cipher-form-cache.service";

import { AdditionalOptionsSectionComponent } from "./additional-options/additional-options-section.component";
import { CardDetailsSectionComponent } from "./card-details-section/card-details-section.component";
import { IdentitySectionComponent } from "./identity/identity.component";
import { ItemDetailsSectionComponent } from "./item-details/item-details-section.component";
import { LoginDetailsSectionComponent } from "./login-details-section/login-details-section.component";
import { NewItemNudgeComponent } from "./new-item-nudge/new-item-nudge.component";
import { SshKeySectionComponent } from "./sshkey-section/sshkey-section.component";

@Component({
  selector: "vault-cipher-form",
  templateUrl: "./cipher-form.component.html",
  providers: [
    {
      provide: CipherFormContainer,
      useExisting: forwardRef(() => CipherFormComponent),
    },
    {
      provide: CipherFormCacheService,
    },
  ],
  imports: [
    AsyncActionsModule,
    TypographyModule,
    ItemModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    ItemDetailsSectionComponent,
    CardDetailsSectionComponent,
    IdentitySectionComponent,
    SshKeySectionComponent,
    NgIf,
    AdditionalOptionsSectionComponent,
    LoginDetailsSectionComponent,
    NewItemNudgeComponent,
  ],
})
export class CipherFormComponent implements AfterViewInit, OnInit, OnChanges, CipherFormContainer {
  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;
  private destroyRef = inject(DestroyRef);
  private _firstInitialized = false;

  /**
   * The form ID to use for the form. Used to connect it to a submit button.
   */
  @Input({ required: true }) formId: string;

  /**
   * The configuration for the add/edit form. Used to determine which controls are shown and what values are available.
   */
  @Input({ required: true }) config: CipherFormConfig;

  /**
   * Optional submit button that will be disabled or marked as loading when the form is submitting.
   */
  @Input()
  submitBtn?: ButtonComponent;

  /**
   * Optional function to call before submitting the form. If the function returns false, the form will not be submitted.
   */
  @Input()
  beforeSubmit: () => Promise<boolean>;

  /**
   * Event emitted when the cipher is saved successfully.
   */
  @Output() cipherSaved = new EventEmitter<CipherView>();

  private formReadySubject = new Subject<void>();

  @Output() formReady = this.formReadySubject.asObservable();

  /**
   * Emitted when the form is enabled
   */
  private formEnabledSubject = new Subject<void>();
  formEnabled$ = this.formEnabledSubject.asObservable();

  /**
   * The original cipher being edited or cloned. Null for add mode.
   */
  originalCipherView: CipherView | null;

  /**
   * The form group for the cipher. Starts empty and is populated by child components via the `registerChildForm` method.
   * @protected
   */
  protected cipherForm = this.formBuilder.group<CipherForm>({});

  /**
   * The value of the updated cipher. Starts as a new cipher (or clone of originalCipher) and is updated
   * by child components via the `patchCipher` method.
   * @protected
   */
  protected updatedCipherView: CipherView | null;

  get website(): string | null {
    return this.updatedCipherView?.login?.uris?.[0]?.uri ?? null;
  }

  protected loading: boolean = true;

  CipherType = CipherType;

  ngAfterViewInit(): void {
    if (this.submitBtn) {
      this.bitSubmit.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
        this.submitBtn.loading.set(loading);
      });

      this.bitSubmit.disabled$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((disabled) => {
        this.submitBtn.disabled.set(disabled);
      });
    }
  }

  disableFormFields(): void {
    this.cipherForm.disable({ emitEvent: false });
  }

  enableFormFields(): void {
    this.cipherForm.enable({ emitEvent: false });
    this.formEnabledSubject.next();
  }

  /**
   * Registers a child form group with the parent form group. Used by child components to add their form groups to
   * the parent form for validation.
   * @param name - The name of the form group.
   * @param group - The form group to add.
   */
  registerChildForm<K extends keyof CipherForm>(
    name: K,
    group: Exclude<CipherForm[K], undefined>,
  ): void {
    this.cipherForm.setControl(name, group);
  }

  /**
   * Method to update the cipherView with the new values. This method should be called by the child form components
   * @param updateFn - A function that takes the current cipherView and returns the updated cipherView
   */
  patchCipher(updateFn: (current: CipherView) => CipherView): void {
    this.updatedCipherView = updateFn(this.updatedCipherView);
    // Cache the updated cipher
    this.cipherFormCacheService.cacheCipherView(this.updatedCipherView);
  }

  /**
   * Return initial values for given keys of a cipher
   */
  getInitialCipherView(): CipherView {
    const cachedCipherView = this.cipherFormCacheService.getCachedCipherView();

    if (cachedCipherView && this.initializedWithCachedCipher()) {
      return cachedCipherView;
    }

    return this.originalCipherView;
  }

  /** */
  initializedWithCachedCipher(): boolean {
    return this.cipherFormCacheService.initializedWithValue;
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

    // Force change detection so that all child components are destroyed and re-created
    this.changeDetectorRef.detectChanges();

    this.updatedCipherView = new CipherView();
    this.originalCipherView = null;
    this.cipherForm = this.formBuilder.group<CipherForm>({});

    if (this.config == null) {
      return;
    }

    if (this.config.mode !== "add") {
      if (this.config.originalCipher == null) {
        throw new Error("Original cipher is required for edit or clone mode");
      }

      this.originalCipherView = await this.addEditFormService.decryptCipher(
        this.config.originalCipher,
      );

      // decryptCipher again to ensure we have a separate instance of CipherView
      this.updatedCipherView = await this.addEditFormService.decryptCipher(
        this.config.originalCipher,
      );

      if (this.config.mode === "clone") {
        this.updatedCipherView.id = null;

        if (this.updatedCipherView.login) {
          this.updatedCipherView.login.fido2Credentials = null;
        }
      }
    } else {
      this.updatedCipherView.type = this.config.cipherType;

      if (this.config.cipherType === CipherType.SecureNote) {
        this.updatedCipherView.secureNote.type = SecureNoteType.Generic;
      }
    }

    this.setInitialCipherFromCache();

    this.loading = false;
    this.formReadySubject.next();
  }

  /**
   * Updates `updatedCipherView` based on the value from the cache.
   */
  setInitialCipherFromCache() {
    const cachedCipher = this.cipherFormCacheService.getCachedCipherView();
    if (cachedCipher === null) {
      return;
    }

    // Use the cached cipher when it matches the cipher being edited
    if (this.updatedCipherView.id === cachedCipher.id) {
      this.updatedCipherView = cachedCipher;
    }
  }

  constructor(
    private formBuilder: FormBuilder,
    private addEditFormService: CipherFormService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private changeDetectorRef: ChangeDetectorRef,
    private cipherFormCacheService: CipherFormCacheService,
  ) {}

  /**
   * Counts the number of invalid fields in a form group.
   * @param formGroup - The form group to count the invalid fields in.
   * @returns The number of invalid fields in the form group.
   */
  private countInvalidFields(formGroup: FormGroup): number {
    return Object.values(formGroup.controls).reduce((count, control) => {
      if (control instanceof FormGroup) {
        return count + this.countInvalidFields(control);
      }
      return count + (control.invalid ? 1 : 0);
    }, 0);
  }

  submit = async () => {
    if (this.cipherForm.invalid) {
      this.cipherForm.markAllAsTouched();

      const invalidFieldsCount = this.countInvalidFields(this.cipherForm);
      if (invalidFieldsCount > 0) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message:
            invalidFieldsCount === 1
              ? this.i18nService.t("singleFieldNeedsAttention")
              : this.i18nService.t("multipleFieldsNeedAttention", invalidFieldsCount),
        });
      }
      return;
    }

    if (this.beforeSubmit) {
      const shouldSubmit = await this.beforeSubmit();
      if (!shouldSubmit) {
        return;
      }
    }

    const savedCipher = await this.addEditFormService.saveCipher(
      this.updatedCipherView,
      this.config,
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        this.config.mode === "edit" || this.config.mode === "partial-edit"
          ? "editedItem"
          : "addedItem",
      ),
    });

    this.cipherSaved.emit(savedCipher);
  };
}
