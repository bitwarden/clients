import { NgIf } from "@angular/common";
import {
  AfterViewInit,
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
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  CardComponent,
  FormFieldModule,
  ItemModule,
  SectionComponent,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";
import { CipherFormService } from "../abstractions/cipher-form.service";
import { CipherForm, CipherFormContainer } from "../cipher-form-container";

import { CardDetailsSectionComponent } from "./card-details-section/card-details-section.component";
import { ItemDetailsSectionComponent } from "./item-details/item-details-section.component";

@Component({
  selector: "vault-cipher-form",
  templateUrl: "./cipher-form.component.html",
  standalone: true,
  providers: [
    {
      provide: CipherFormContainer,
      useExisting: forwardRef(() => CipherFormComponent),
    },
  ],
  imports: [
    AsyncActionsModule,
    CardComponent,
    SectionComponent,
    TypographyModule,
    ItemModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    ItemDetailsSectionComponent,
    CardDetailsSectionComponent,
    NgIf,
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
   * Event emitted when the cipher is saved successfully.
   */
  @Output() cipherSaved = new EventEmitter<CipherView>();

  /**
   * The form group for the cipher. Starts empty and is populated by child components via the `registerChildForm` method.
   * @protected
   */
  protected cipherForm = this.formBuilder.group<CipherForm>({});

  /**
   * The original cipher being edited or cloned. Null for add mode.
   * @protected
   */
  protected originalCipherView: CipherView | null;

  /**
   * The value of the updated cipher. Starts as a new cipher (or clone of originalCipher) and is updated
   * by child components via the `patchCipher` method.
   * @protected
   */
  protected updatedCipherView: CipherView | null;
  protected loading: boolean = true;

  CipherType = CipherType;

  ngAfterViewInit(): void {
    if (this.submitBtn) {
      this.bitSubmit.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((loading) => {
        this.submitBtn.loading = loading;
      });

      this.bitSubmit.disabled$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((disabled) => {
        this.submitBtn.disabled = disabled;
      });
    }
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
   * Patches the updated cipher with the provided partial cipher. Used by child components to update the cipher
   * as their form values change.
   * @param cipher
   */
  patchCipher(cipher: Partial<CipherView>): void {
    this.updatedCipherView = Object.assign(this.updatedCipherView, cipher);
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
    this.updatedCipherView = new CipherView();
    this.originalCipherView = null;
    this.cipherForm.reset();

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

      this.updatedCipherView = Object.assign(this.updatedCipherView, this.originalCipherView);
    } else {
      this.updatedCipherView.type = this.config.cipherType;
    }

    this.loading = false;
  }

  constructor(
    private formBuilder: FormBuilder,
    private addEditFormService: CipherFormService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  submit = async () => {
    if (this.cipherForm.invalid) {
      this.cipherForm.markAllAsTouched();
      return;
    }

    await this.addEditFormService.saveCipher(this.updatedCipherView, this.config);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        this.config.mode === "edit" || this.config.mode === "partial-edit"
          ? "editedItem"
          : "addedItem",
      ),
    });

    this.cipherSaved.emit(this.updatedCipherView);
  };
}
