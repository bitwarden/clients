// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { AsyncPipe } from "@angular/common";
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { filter, map, shareReplay, Subject, switchMap, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import { DESKTOP_APP_URI_PREFIX } from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  MenuModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";
import { CipherFormHTTPAuthenticationService } from "../../services/cipher-form-http-authentication.service";

import { DesktopAppRow, UriOptionComponent } from "./uri-option.component";

interface UriField {
  uri: string;
  matchDetection: UriMatchStrategySetting;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    FormFieldModule,
    SelectModule,
    IconButtonModule,
    UriOptionComponent,
    LinkModule,
    MenuModule,
    AsyncPipe,
  ],
})
export class AutofillOptionsComponent implements OnInit {
  /**
   * List of rendered UriOptionComponents. Used for focusing newly added Uri inputs.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChildren(UriOptionComponent)
  protected uriOptions: QueryList<UriOptionComponent>;

  autofillOptionsForm = this.formBuilder.group({
    uris: this.formBuilder.array<UriField>([]),
    autofillOnPageLoad: [null as boolean],
  });

  protected get uriControls() {
    return this.autofillOptionsForm.controls.uris.controls;
  }

  protected get isPartialEdit() {
    return this.cipherFormContainer.config.mode === "partial-edit";
  }

  protected defaultMatchDetection$ =
    this.domainSettingsService.resolvedDefaultUriMatchStrategy$.pipe(
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

  private readonly isWindowsDesktop =
    this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop;

  // The feature flag is read once, when the form opens, so the URIs don't change while the user
  // edits them
  private readonly autotypeGaEnabled$ = autotypeFeatureFlagState$(this.configService).pipe(
    map((state) => state === AutotypeFeatureFlagState.Ga),
    take(1),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Whether desktop app URIs are shown as desktop apps. Desktop apps can be viewed on any client. */
  protected readonly showDesktopApps = toSignal(this.autotypeGaEnabled$, { initialValue: false });

  /** Whether desktop apps can be added. Desktop apps can only be added on Windows desktop. */
  protected readonly showAddAppDropdown = computed(
    () => this.isWindowsDesktop && this.showDesktopApps(),
  );

  /**
   * The URI inputs of desktop app rows, and how each row was created. A row's type is set when the
   * row is created, so typing a desktop app URI into a website row doesn't make it a desktop app row.
   */
  protected readonly desktopAppRows = new WeakMap<AbstractControl, DesktopAppRow>();

  private httpAuthenticationService = inject(CipherFormHTTPAuthenticationService);
  private destroyRef = inject(DestroyRef);

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private liveAnnouncer: LiveAnnouncer,
    private domainSettingsService: DomainSettingsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
  ) {
    this.cipherFormContainer.registerChildForm("autoFillOptions", this.autofillOptionsForm);

    this.autofillOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.publishUriMatchStrategies();
      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.login.uris = value.uris?.map((uri: UriField) =>
          Object.assign(new LoginUriView(), {
            uri: uri.uri,
            match: this.savedMatchDetection(uri),
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

    this.cipherFormContainer.formStatusChange$.pipe(takeUntilDestroyed()).subscribe((status) => {
      // Disable adding new URIs when the cipher form is disabled
      if (status === "disabled") {
        this.autofillOptionsForm.disable({ emitEvent: false });
      } else if (!this.isPartialEdit) {
        this.autofillOptionsForm.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    if (prefillCipher) {
      this.initFromExistingCipher(prefillCipher.login);
    } else {
      this.initNewCipher();
    }

    // URIs from an existing cipher are added without emitting value changes
    this.publishUriMatchStrategies();

    this.autotypeGaEnabled$
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.saveDesktopAppUrisWithNeverMatch());

    if (this.isPartialEdit) {
      this.autofillOptionsForm.disable();
    }
  }

  /** Shares the current URI match strategies with the HTTP authentication setting */
  private publishUriMatchStrategies() {
    this.httpAuthenticationService.updateUriMatchStrategies(
      this.uriControls.map((control) => control.value?.matchDetection ?? null),
    );
  }

  /**
   * Adds a new URI input requested by the user. When the new URI uses the default match strategy,
   * the user is asked to confirm when that would turn HTTP authentication off.
   * @param uriFieldValue The initial value for the new URI input.
   * @param desktopAppRow How the new URI input was created, when it's a desktop app row.
   */
  async addUriFromUser(uriFieldValue: UriField, desktopAppRow: DesktopAppRow | null = null) {
    if (
      uriFieldValue.matchDetection == null &&
      !(await this.httpAuthenticationService.confirmDefaultMatchStrategy())
    ) {
      return;
    }

    this.addUri(uriFieldValue, true, true, desktopAppRow);
  }

  /**
   * Adds a new desktop app URI requested by the user. Desktop app URIs are never matched against
   * websites, so they use the Never match strategy. That keeps them out of website autofill and
   * HTTP authentication matching, and counts as an explicit strategy for HTTP authentication.
   */
  async addDesktopAppUriFromUser() {
    await this.addUriFromUser(
      {
        uri: DESKTOP_APP_URI_PREFIX,
        matchDetection: UriMatchStrategy.Never,
      },
      DesktopAppRow.New,
    );
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
        // Desktop app URIs on the cipher load as desktop apps, including ones that were typed into a
        // website row
        uri.uri?.startsWith(DESKTOP_APP_URI_PREFIX) ? DesktopAppRow.Saved : null,
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

        this.autofillOptions[0].label = this.i18nService.t(
          "defaultLabelWithValue",
          defaultOption.label,
        );
        // Trigger change detection to update the label in the template
        this.autofillOptions = [...this.autofillOptions];
      });
  }

  /**
   * Adds a new URI input to the form.
   * @param uriFieldValue The initial value for the new URI input.
   * @param focusNewInput If true, the new URI input will be focused after being added.
   * @param emitEvent When false, prevents the `valueChanges` & `statusChanges` observables from firing.
   * @param desktopAppRow How the new URI input was created, when it's a desktop app row.
   */
  addUri(
    uriFieldValue: UriField = { uri: null, matchDetection: null },
    focusNewInput = false,
    emitEvent = true,
    desktopAppRow: DesktopAppRow | null = null,
  ) {
    const control = this.formBuilder.control(uriFieldValue);
    if (desktopAppRow != null) {
      this.desktopAppRows.set(control, desktopAppRow);
    }

    this.autofillOptionsForm.controls.uris.push(control, { emitEvent });

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
            match: this.savedMatchDetection(control.value) ?? null,
          }) as LoginUriView,
      );
      return cipher;
    });
  }

  /**
   * Returns the match strategy a URI is saved with. While desktop apps are shown, desktop app URIs
   * are saved with the Never match strategy, including ones typed into a website row, because they
   * load as desktop apps.
   */
  private savedMatchDetection(uri: UriField): UriMatchStrategySetting {
    return this.showDesktopApps() && uri?.uri?.startsWith(DESKTOP_APP_URI_PREFIX)
      ? UriMatchStrategy.Never
      : uri?.matchDetection;
  }

  /**
   * Saves the desktop app URIs already on the cipher with the Never match strategy, even when the
   * user doesn't change the URIs.
   */
  private saveDesktopAppUrisWithNeverMatch() {
    const matchChanged = this.uriControls.some(
      (control) =>
        (this.savedMatchDetection(control.value) ?? null) !==
        (control.value?.matchDetection ?? null),
    );

    if (matchChanged) {
      this.updateUriFields();
    }
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
