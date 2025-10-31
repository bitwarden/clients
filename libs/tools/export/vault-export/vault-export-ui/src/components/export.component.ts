// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  Optional,
} from "@angular/core";
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  from,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PasswordStrengthV2Component } from "@bitwarden/angular/tools/password-strength/password-strength-v2.component";
import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ClientType, EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { pin } from "@bitwarden/common/tools/rx";
import { isId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonModule,
  CalloutModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  RadioButtonModule,
  SelectModule,
  ToastService,
} from "@bitwarden/components";
import { GeneratorServicesModule } from "@bitwarden/generator-components";
import { CredentialGeneratorService, GenerateRequest, Type } from "@bitwarden/generator-core";
import {
  ExportedVault,
  ExportFormatMetadata,
  VaultExportServiceAbstraction,
} from "@bitwarden/vault-export-core";

import { EncryptedExportType } from "../enums/encrypted-export-type.enum";

import { ExportScopeCalloutComponent } from "./export-scope-callout.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-export",
  templateUrl: "export.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    SelectModule,
    CalloutModule,
    RadioButtonModule,
    ExportScopeCalloutComponent,
    PasswordStrengthV2Component,
    GeneratorServicesModule,
  ],
})
export class ExportComponent implements OnInit, OnDestroy, AfterViewInit {
  /**
   * The organization ID passed as @Input by the Admin Console
   * The password manager will not set this, and sends org id using a form control ( see ngOnInit() )
   */
  private _organizationIdFromInput$ = new BehaviorSubject<OrganizationId | undefined>(undefined);

  /**
   * The organization ID to export from, as determined using @Input in Admin Console context
   * or vault selector form control in Password Manager context
   */
  protected organizationId$: Observable<OrganizationId | undefined>;

  private createDefaultLocationFlagEnabled$: Observable<boolean>;
  private _showExcludeMyItems = false;

  // TODO: Fix this the next time the file is edited.
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() set organizationId(value: OrganizationId | string | undefined) {
    if (Utils.isNullOrEmpty(value)) {
      this._organizationIdFromInput$.next(undefined);
      return;
    }

    if (!isId<OrganizationId>(value)) {
      this._organizationIdFromInput$.next(undefined);
      return;
    }

    this._organizationIdFromInput$.next(value);

    getUserId(this.accountService.activeAccount$)
      .pipe(
        switchMap((userId) => this.organizationService.organizations$(userId).pipe(getById(value))),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((organization) => {
        this._organizationIdFromInput$.next(organization?.id);
      });
  }

  get organizationId(): OrganizationId | undefined {
    return this._organizationIdFromInput$.value;
  }

  get showExcludeMyItems(): boolean {
    return this._showExcludeMyItems;
  }

  get orgExportDescription(): string {
    if (!this._showExcludeMyItems) {
      return "exportingOrganizationVaultDesc";
    }
    return this.isAdminConsoleContext
      ? "exportingOrganizationVaultFromAdminConsoleWithDataOwnershipDesc"
      : "exportingOrganizationVaultFromPasswordManagerWithDataOwnershipDesc";
  }

  private get isAdminConsoleContext(): boolean {
    const isWeb = this.platformUtilsService.getClientType?.() === ClientType.Web;
    if (!isWeb || !this.router) {
      return false;
    }
    try {
      const url = this.router.url ?? "";
      return url.includes("/organizations/");
    } catch {
      return false;
    }
  }

  /**
   * The hosting control also needs a bitSubmitDirective (on the Submit button) which calls this components {@link submit}-method.
   * This components formState (loading/disabled) is emitted back up to the hosting component so for example the Submit button can be enabled/disabled and show loading state.
   */
  // TODO: Fix this the next time the file is edited.
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;

  /**
   * Emits true when the BitSubmitDirective({@link bitSubmit} is executing {@link submit} and false when execution has completed.
   * Example: Used to show the loading state of the submit button present on the hosting component
   * */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  formLoading = new EventEmitter<boolean>();

  /**
   * Emits true when this form gets disabled and false when enabled.
   * Example: Used to disable the submit button, which is present on the hosting component
   * */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  formDisabled = new EventEmitter<boolean>();

  /**
   * Emits when the creation and download of the export-file have succeeded
   * - Emits an undefined when exporting from an individual vault
   * - Emits the organizationId when exporting from an organizational vault
   * */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  onSuccessfulExport = new EventEmitter<OrganizationId | undefined>();

  // TODO: Fix this the next time the file is edited.
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(PasswordStrengthV2Component) passwordStrengthComponent: PasswordStrengthV2Component;

  encryptedExportType = EncryptedExportType;
  protected showFilePassword: boolean;

  private _disabledByPolicy = false;

  organizations$: Observable<Organization[]>;

  protected get disabledByPolicy(): boolean {
    return this._disabledByPolicy;
  }

  disablePersonalVaultExportPolicy$: Observable<boolean>;
  // detects if policy is enabled and applies to the user, admins are exempted
  organizationDataOwnershipPolicyAppliesToUser$: Observable<boolean>;
  // detects if policy is enabled regardless of admin exemption
  organizationDataOwnershipPolicyEnabledForOrg$: Observable<boolean>;

  exportForm = this.formBuilder.group({
    vaultSelector: [
      "myVault",
      {
        nonNullable: true,
        validators: [Validators.required],
      },
    ],
    format: ["json", Validators.required],
    secret: [""],
    filePassword: ["", Validators.required],
    confirmFilePassword: ["", Validators.required],
    fileEncryptionType: [EncryptedExportType.AccountEncrypted],
  });

  /**
   * Observable stream of available export format options
   * Dynamically updates based on vault selection (My Vault vs Organization)
   */
  formatOptions$: Observable<ExportFormatMetadata[]>;

  private destroy$ = new Subject<void>();
  private onlyManagedCollections = true;
  private onGenerate$ = new Subject<GenerateRequest>();

  constructor(
    protected i18nService: I18nService,
    protected toastService: ToastService,
    protected exportService: VaultExportServiceAbstraction,
    protected eventCollectionService: EventCollectionService,
    protected generatorService: CredentialGeneratorService,
    private policyService: PolicyService,
    private logService: LogService,
    private formBuilder: UntypedFormBuilder,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected organizationService: OrganizationService,
    private accountService: AccountService,
    private collectionService: CollectionService,
    private configService: ConfigService,
    private platformUtilsService: PlatformUtilsService,
    @Optional() private router?: Router,
  ) {}

  async ngOnInit() {
    const exportingFromAdminConsole: boolean = this.isAdminConsoleContext;
    // Create organizationId$ as a combined observable from @Input and form changes
    const organizationIdFromForm$ = this.exportForm.controls.vaultSelector.valueChanges.pipe(
      map((vaultSelection) => {
        if (exportingFromAdminConsole) {
          // In Admin Console, ignore form changes - use input value
          return undefined;
        }
        // In Password Manager, map form selection to organizationId
        const isMyVault = vaultSelection === "myVault";
        return isMyVault ? undefined : (vaultSelection as OrganizationId);
      }),
      startWith(undefined as OrganizationId | undefined),
    );

    this.organizationId$ = combineLatest([
      this._organizationIdFromInput$,
      organizationIdFromForm$,
    ]).pipe(
      map(([inputOrgId, formOrgId]) => {
        // Admin Console context: use input value
        if (exportingFromAdminConsole) {
          return inputOrgId;
        }
        // Password Manager context: use form value
        return formOrgId;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.observeFeatureFlags();
    this.observeFormState();
    this.observePolicyStatus();
    this.observeFormSelections();

    // order is important below this line
    this.observeMyItemsExclusionCriteria();
    this.observeValidatorAdjustments();
    this.setupPasswordGeneration();

    if (this.organizationId) {
      // organization vault export
      this.initOrganizationOnly();
      return;
    }

    // individual vault export
    this.initIndividual();
    this.setupPolicyBasedFormState();
  }

  private observeFeatureFlags(): void {
    this.createDefaultLocationFlagEnabled$ = from(
      this.configService.getFeatureFlag(FeatureFlag.CreateDefaultLocation),
    ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  private observeFormState(): void {
    this.exportForm.statusChanges.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      this.formDisabled.emit(c === "DISABLED");
    });
  }

  private observePolicyStatus(): void {
    this.disablePersonalVaultExportPolicy$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.DisablePersonalVaultExport, userId),
      ),
    );

    // when true, html template will hide "My Vault" option in vault selector drop down
    this.organizationDataOwnershipPolicyAppliesToUser$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
      ),
    );

    /*
      Determines how organization exports are described in the callout.
      Admins are exempted from organization data ownership policy,
      and so this needs to determine if the policy is enabled for the org, not if it applies to the user.
    */
    this.organizationDataOwnershipPolicyEnabledForOrg$ = combineLatest([
      this.accountService.activeAccount$.pipe(getUserId),
      this.organizationId$,
    ]).pipe(
      switchMap(([userId, organizationId]) => {
        if (!organizationId || !userId) {
          return of(false);
        }
        return this.policyService.policies$(userId).pipe(
          map((policies) => {
            const policy = policies?.find(
              (p) =>
                p.type === PolicyType.OrganizationDataOwnership &&
                p.organizationId === organizationId,
            );
            return policy?.enabled ?? false;
          }),
        );
      }),
    );
  }

  private observeFormSelections(): void {
    // Set up dynamic format options based on the organizationId$ observable
    // organizationId$ already combines input and form changes
    this.formatOptions$ = this.organizationId$.pipe(
      map((organizationId) => {
        const isMyVault = !organizationId;
        return { isMyVault };
      }),
      switchMap((options) => this.exportService.formats$(options)),
      tap((formats) => {
        // Preserve the current format selection if it's still available in the new format list
        const currentFormat = this.exportForm.get("format").value;
        const isFormatAvailable = formats.some((f) => f.format === currentFormat);

        // Only reset to json if the current format is no longer available
        if (!isFormatAvailable) {
          this.exportForm.get("format").setValue("json");
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * Determine value of showExcludeMyItems. Returns true when:
   * CreateDefaultLocation feature flag is on
   * AND organizationDataOwnershipPolicy is enabled for the selected organization
   * AND a valid OrganizationId is present (not exporting from individual vault)
   */
  private observeMyItemsExclusionCriteria(): void {
    combineLatest({
      createDefaultLocationFlagEnabled: this.createDefaultLocationFlagEnabled$,
      organizationDataOwnershipPolicyEnabledForOrg:
        this.organizationDataOwnershipPolicyEnabledForOrg$,
      organizationId: this.organizationId$,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        ({
          createDefaultLocationFlagEnabled,
          organizationDataOwnershipPolicyEnabledForOrg,
          organizationId,
        }) => {
          if (!createDefaultLocationFlagEnabled || !organizationId) {
            this._showExcludeMyItems = false;
            return;
          }

          this._showExcludeMyItems = organizationDataOwnershipPolicyEnabledForOrg;
        },
      );
  }

  // Setup validator adjustments based on format and encryption type changes
  private observeValidatorAdjustments(): void {
    merge(
      this.exportForm.get("format").valueChanges,
      this.exportForm.get("fileEncryptionType").valueChanges,
    )
      .pipe(startWith(0), takeUntil(this.destroy$))
      .subscribe(() => this.adjustValidators());
  }

  // Wire up the password generation for password-protected exports
  private setupPasswordGeneration(): void {
    const account$ = this.accountService.activeAccount$.pipe(
      pin({
        name() {
          return "active export account";
        },
        distinct(previous, current) {
          return previous.id === current.id;
        },
      }),
    );

    this.generatorService
      .generate$({ on$: this.onGenerate$, account$ })
      .pipe(takeUntil(this.destroy$))
      .subscribe((generated) => {
        this.exportForm.patchValue({
          filePassword: generated.credential,
          confirmFilePassword: generated.credential,
        });
      });
  }

  /*
  Initialize component for organization only export
  Hides "My Vault" option by returning immediately
  */
  private initOrganizationOnly(): void {
    this.organizations$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.organizationService
          .memberOrganizations$(userId)
          .pipe(map((orgs) => orgs.filter((org) => org.id == this.organizationId))),
      ),
    );
    this.exportForm.controls.vaultSelector.patchValue(this.organizationId);
    this.exportForm.controls.vaultSelector.disable();

    this.onlyManagedCollections = false;
  }

  // Initialize component to support individual and organizational exports
  private initIndividual(): void {
    this.organizations$ = this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          combineLatest({
            collections: this.collectionService.decryptedCollections$(userId),
            memberOrganizations: this.organizationService.memberOrganizations$(userId),
          }),
        ),
      )
      .pipe(
        map(({ collections, memberOrganizations }) => {
          const managedCollectionsOrgIds = new Set(
            collections.filter((c) => c.manage).map((c) => c.organizationId),
          );
          const filteredOrgs = memberOrganizations.filter((org) =>
            managedCollectionsOrgIds.has(org.id),
          );
          return filteredOrgs.sort(Utils.getSortFunction(this.i18nService, "name"));
        }),
      );
  }

  private setupPolicyBasedFormState(): void {
    combineLatest([
      this.disablePersonalVaultExportPolicy$,
      this.organizationDataOwnershipPolicyAppliesToUser$,
      this.organizations$,
    ])
      .pipe(
        tap(([disablePersonalVaultExport, organizationDataOwnership, organizations]) => {
          this._disabledByPolicy = disablePersonalVaultExport;

          // When organizationDataOwnership is enabled and we have orgs, set the first org as the selected vault
          if (organizationDataOwnership && organizations.length > 0) {
            this.exportForm.enable();
            this.exportForm.controls.vaultSelector.setValue(organizations[0].id);
          }

          // When organizationDataOwnership is enabled and we have no orgs, disable the form
          if (organizationDataOwnership && organizations.length === 0) {
            this.exportForm.disable();
          }

          // When personalVaultExport is disabled, disable the form
          if (disablePersonalVaultExport) {
            this.exportForm.disable();
          }

          // When neither policy is enabled, enable the form and set the default vault to "myVault"
          if (!disablePersonalVaultExport && !organizationDataOwnership) {
            this.exportForm.controls.vaultSelector.setValue("myVault");
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.formLoading.emit(loading);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get encryptedFormat() {
    return this.format === "encrypted_json";
  }

  get isFileEncryptedExport() {
    return (
      this.format === "encrypted_json" &&
      this.fileEncryptionType === EncryptedExportType.FileEncrypted
    );
  }

  get isAccountEncryptedExport() {
    return (
      this.format === "encrypted_json" &&
      this.fileEncryptionType === EncryptedExportType.AccountEncrypted
    );
  }

  protected async doExport() {
    try {
      const data = await this.getExportData();

      // Download the export file
      this.downloadFile(data);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("exportSuccess"),
      });
      this.onSuccessfulExport.emit(this.organizationId);
      await this.collectEvent();
      this.exportForm.get("secret").setValue("");
      this.exportForm.clearValidators();
    } catch (e) {
      this.logService.error(e);
    }
  }

  generatePassword = async () => {
    this.onGenerate$.next({ source: "export", type: Type.password });
  };

  submit = async () => {
    if (this.isFileEncryptedExport && this.filePassword != this.confirmFilePassword) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("filePasswordAndConfirmFilePasswordDoNotMatch"),
      });
      return;
    }

    this.exportForm.markAllAsTouched();
    if (this.exportForm.invalid) {
      return;
    }

    if (this.disabledByPolicy) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("personalVaultExportPolicyInEffect"),
      });
      return;
    }

    const userVerified = await this.verifyUser();
    if (!userVerified) {
      return;
    }

    await this.doExport();
  };

  private async verifyUser(): Promise<boolean> {
    let confirmDescription = "exportWarningDesc";
    if (this.isFileEncryptedExport) {
      confirmDescription = "fileEncryptedExportWarningDesc";
    } else if (this.isAccountEncryptedExport) {
      confirmDescription = "encExportKeyWarningDesc";
    }

    const result = await UserVerificationDialogComponent.open(this.dialogService, {
      title: "confirmVaultExport",
      bodyText: confirmDescription,
      confirmButtonOptions: {
        text: "exportVault",
        type: "primary",
      },
    });

    // Handle the result of the dialog based on user action and verification success
    if (result.userAction === "cancel") {
      // User cancelled the dialog
      return false;
    }

    // User confirmed the dialog so check verification success
    if (!result.verificationSuccess) {
      if (result.noAvailableClientVerificationMethods) {
        // No client-side verification methods are available
        // Could send user to configure a verification method like PIN or biometrics
      }
      return false;
    }
    return true;
  }

  protected async getExportData(): Promise<ExportedVault> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return Utils.isNullOrWhitespace(this.organizationId)
      ? this.exportService.getExport(userId, this.format, this.filePassword)
      : this.exportService.getOrganizationExport(
          userId,
          this.organizationId,
          this.format,
          this.filePassword,
          this.onlyManagedCollections,
        );
  }

  protected async collectEvent(): Promise<void> {
    if (this.organizationId) {
      return await this.eventCollectionService.collect(
        EventType.Organization_ClientExportedVault,
        null,
        false,
        this.organizationId,
      );
    }
    return await this.eventCollectionService.collect(EventType.User_ClientExportedVault);
  }

  get format() {
    return this.exportForm.get("format").value;
  }

  get filePassword() {
    return this.exportForm.get("filePassword").value;
  }

  get confirmFilePassword() {
    return this.exportForm.get("confirmFilePassword").value;
  }

  get fileEncryptionType() {
    return this.exportForm.get("fileEncryptionType").value;
  }

  adjustValidators() {
    this.exportForm.get("confirmFilePassword").reset();
    this.exportForm.get("filePassword").reset();

    if (this.encryptedFormat && this.fileEncryptionType == EncryptedExportType.FileEncrypted) {
      this.exportForm.controls.filePassword.enable();
      this.exportForm.controls.confirmFilePassword.enable();
    } else {
      this.exportForm.controls.filePassword.disable();
      this.exportForm.controls.confirmFilePassword.disable();
    }
  }

  private downloadFile(exportedVault: ExportedVault): void {
    this.fileDownloadService.download({
      fileName: exportedVault.fileName,
      blobData: exportedVault.data,
      blobOptions: { type: exportedVault.type },
    });
  }
}
