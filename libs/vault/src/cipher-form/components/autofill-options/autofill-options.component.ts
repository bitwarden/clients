// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { AsyncPipe, NgForOf, NgIf } from "@angular/common";
import { Component, OnInit, QueryList, ViewChildren } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { filter, Subject, switchMap, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

import { UriOptionComponent } from "./uri-option.component";

interface UriField {
  uri: string;
  matchDetection: UriMatchStrategySetting;
}

@Component({
  selector: "vault-autofill-options",
  templateUrl: "./autofill-options.component.html",
  imports: [
    DragDropModule,
    SectionHeaderComponent,
    TypographyModule,
    JslibModule,
    CardComponent,
    ReactiveFormsModule,
    NgForOf,
    FormFieldModule,
    SelectModule,
    IconButtonModule,
    UriOptionComponent,
    LinkModule,
    NgIf,
    AsyncPipe,
  ],
})
export class AutofillOptionsComponent implements OnInit {
  /**
   * List of rendered UriOptionComponents. Used for focusing newly added Uri inputs.
   */
  @ViewChildren(UriOptionComponent)
  protected uriOptions: QueryList<UriOptionComponent>;

  autofillOptionsForm = this.formBuilder.group({
    uris: this.formBuilder.array<UriField>([]),
    autofillOnPageLoad: [null as boolean],
  });

  protected get uriControls() {
    return this.autofillOptionsForm.controls.uris.controls;
  }

  protected defaultMatchDetection$ = this.domainSettingsService.defaultUriMatchStrategy$.pipe(
    // The default match detection should only be shown when used on the browser
    filter(() => this.platformUtilsService.getClientType() == ClientType.Browser),
  );
  protected autofillOnPageLoadEnabled$ = this.autofillSettingsService.autofillOnPageLoad$;

  protected autofillOptions: { label: string; value: boolean | null }[] = [
    { label: this.i18nService.t("default"), value: null },
    { label: this.i18nService.t("yes"), value: true },
    { label: this.i18nService.t("no"), value: false },
  ];

  /**
   * Emits when a new URI input is added to the form and should be focused.
   */
  private focusOnNewInput$ = new Subject<void>();

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private liveAnnouncer: LiveAnnouncer,
    private domainSettingsService: DomainSettingsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.cipherFormContainer.registerChildForm("autoFillOptions", this.autofillOptionsForm);

    this.autofillOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.login.uris = value.uris.map((uri: UriField) =>
          Object.assign(new LoginUriView(), {
            uri: uri.uri,
            match: uri.matchDetection,
          } as LoginUriView),
        );
        cipher.login.autofillOnPageLoad = value.autofillOnPageLoad;
        return cipher;
      });
    });

    this.updateDefaultAutofillLabel();

    this.focusOnNewInput$
      .pipe(
        takeUntilDestroyed(),
        // Wait for the new URI input to be added to the DOM
        switchMap(() => this.uriOptions.changes.pipe(take(1))),
        // Announce the new URI input before focusing it
        switchMap(() => this.liveAnnouncer.announce(this.i18nService.t("websiteAdded"), "polite")),
      )
      .subscribe(() => {
        this.uriOptions?.last?.focusInput();
      });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    if (prefillCipher) {
      this.initFromExistingCipher(prefillCipher.login);
    } else {
      this.initNewCipher();
    }

    if (this.cipherFormContainer.config.mode === "partial-edit") {
      this.autofillOptionsForm.disable();
    }
  }

  private initFromExistingCipher(existingLogin: LoginView) {
    // The `uris` control is a FormArray which needs to dynamically
    // add controls to the form. Doing this will trigger the `valueChanges` observable on the form
    // and overwrite the `autofillOnPageLoad` value before it is set in the following `patchValue` call.
    // Pass `false` to `addUri` to stop events from emitting when adding the URIs.
    existingLogin.uris?.forEach((uri) => {
      this.addUri(
        {
          uri: uri.uri,
          matchDetection: uri.match,
        },
        false,
        false,
      );
    });
    this.autofillOptionsForm.patchValue({
      autofillOnPageLoad: existingLogin.autofillOnPageLoad,
    });

    // Only add the initial value when the cipher was not initialized from a cached state
    if (
      this.cipherFormContainer.config.initialValues?.loginUri &&
      !this.cipherFormContainer.initializedWithCachedCipher()
    ) {
      // Avoid adding the same uri again if it already exists
      if (
        existingLogin.uris?.findIndex(
          (uri) => uri.uri === this.cipherFormContainer.config.initialValues.loginUri,
        ) === -1
      ) {
        this.addUri({
          uri: this.cipherFormContainer.config.initialValues.loginUri,
          matchDetection: null,
        });
      }
    }
  }

  private initNewCipher() {
    this.addUri({
      uri: this.cipherFormContainer.config.initialValues?.loginUri ?? null,
      matchDetection: null,
    });
    this.autofillOptionsForm.patchValue({
      autofillOnPageLoad: null,
    });
  }

  private updateDefaultAutofillLabel() {
    this.autofillSettingsService.autofillOnPageLoadDefault$
      .pipe(takeUntilDestroyed())
      .subscribe((value: boolean) => {
        const defaultOption = this.autofillOptions.find((o) => o.value === value);

        if (!defaultOption) {
          return;
        }

        this.autofillOptions[0].label = this.i18nService.t("defaultLabel", defaultOption.label);
        // Trigger change detection to update the label in the template
        this.autofillOptions = [...this.autofillOptions];
      });
  }

  /**
   * Adds a new URI input to the form.
   * @param uriFieldValue The initial value for the new URI input.
   * @param focusNewInput If true, the new URI input will be focused after being added.
   * @param emitEvent When false, prevents the `valueChanges` & `statusChanges` observables from firing.
   */
  addUri(
    uriFieldValue: UriField = { uri: null, matchDetection: null },
    focusNewInput = false,
    emitEvent = true,
  ) {
    this.autofillOptionsForm.controls.uris.push(this.formBuilder.control(uriFieldValue), {
      emitEvent,
    });

    if (focusNewInput) {
      this.focusOnNewInput$.next();
    }
  }

  removeUri(i: number) {
    this.autofillOptionsForm.controls.uris.removeAt(i);
  }

  /** Create a new list of LoginUriViews from the form objects and update the cipher */
  private updateUriFields() {
    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.login.uris = this.uriControls.map(
        (control) =>
          Object.assign(new LoginUriView(), {
            uri: control.value.uri,
            match: control.value.matchDetection ?? null,
          }) as LoginUriView,
      );
      return cipher;
    });
  }

  /** Reorder the controls to match the new order after a "drop" event */
  onUriItemDrop(event: CdkDragDrop<HTMLDivElement>) {
    moveItemInArray(this.uriControls, event.previousIndex, event.currentIndex);
    this.updateUriFields();
  }

  /** Handles a uri item keyboard up or down event */
  async onUriItemKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowUp" && index !== 0) {
      await this.reorderUriItems(event, index, "Up");
    }

    if (event.key === "ArrowDown" && index !== this.uriControls.length - 1) {
      await this.reorderUriItems(event, index, "Down");
    }
  }

  /** Reorders the uri items from a keyboard up or down event */
  async reorderUriItems(event: KeyboardEvent, previousIndex: number, direction: "Up" | "Down") {
    const currentIndex = previousIndex + (direction === "Up" ? -1 : 1);
    event.preventDefault();
    await this.liveAnnouncer.announce(
      this.i18nService.t(
        `reorderField${direction}`,
        this.i18nService.t("websiteUri"),
        currentIndex + 1,
        this.uriControls.length,
      ),
      "assertive",
    );
    moveItemInArray(this.uriControls, previousIndex, currentIndex);
    this.updateUriFields();
    // Refocus the button after the reorder
    // Angular re-renders the list when moving an item up which causes the focus to be lost
    // Wait for the next tick to ensure the button is rendered before focusing
    requestAnimationFrame(() => {
      (event.target as HTMLButtonElement).focus();
    });
  }
}
