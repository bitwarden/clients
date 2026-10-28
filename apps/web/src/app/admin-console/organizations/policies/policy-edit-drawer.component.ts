import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Directive,
  Inject,
  ViewContainerRef,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControlStatus } from "@angular/forms";
import {
  EMPTY,
  Subject,
  map,
  firstValueFrom,
  merge,
  shareReplay,
  switchMap,
  filter,
  of,
  startWith,
} from "rxjs";
import { Constructor } from "type-fest";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";

import { SharedModule } from "../../../shared";

import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  policyDrawerTitleKeys,
  policyDrawerDescriptionKeys,
  policyTitleKeys,
} from "./base-policy-edit.component";

export type PolicyEditDialogData = {
  /**
   * The metadata containing information about how to display and edit the policy.
   */
  policy: BasePolicyEditDefinition;
  /**
   * The organization for the policy.
   */
  organization: Organization;
};

export type PolicyEditDialogResult = "saved";

/**
 * Serializes the policy form's values for comparison. Array order is ignored so that e.g.
 * reordering multi-select values doesn't count as a change.
 */
function serializePolicyForm(component: BasePolicyEditComponent): string {
  return JSON.stringify(
    { enabled: component.enabled.value, data: component.data?.getRawValue() ?? null },
    (_key, value) => (Array.isArray(value) ? [...value].sort() : value),
  );
}

/**
 * Abstract base class shared by {@link PolicyEditDrawerComponent} and
 * {@link MultiStepPolicyEditDialogComponent}. Contains all the constructor-injected services,
 * shared signals, and shared logic (load, discard guard) so concrete subclasses only need to
 * implement the template-specific parts ({@link ngAfterViewInit} and {@link submit}).
 */
@Directive()
export abstract class PolicyEditDialogComponent implements AfterViewInit {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly terminology = inject(Vfo1TerminologyService);
  /** Disarmed on lock/logout so neither closePredicate nor beforeunload prompts during teardown. */
  protected readonly guardArmed = signal(true);
  protected readonly loading = signal(true);
  protected readonly policyComponent = signal<BasePolicyEditComponent | undefined>(undefined);
  protected readonly policyEnabled = signal(false);
  /** Emits the policy component once its form has been populated with the loaded policy. */
  private readonly loadedPolicyComponent$ = new Subject<BasePolicyEditComponent>();
  /**
   * Whether the policy form differs from its state when the dialog finished loading.
   * Stays false until {@link trackPolicyChanges} has recorded the initial state. Comparing against
   * the initial form state, rather than the stored policy data, means policies that fill in
   * defaults for unsaved data or transform data before saving don't appear changed as soon as
   * they load.
   */
  protected readonly policyChanged$ = this.loadedPolicyComponent$.pipe(
    switchMap((component) => {
      const initialState = serializePolicyForm(component);
      return merge(component.enabled.valueChanges, component.data?.valueChanges ?? EMPTY).pipe(
        map(() => serializePolicyForm(component) !== initialState),
      );
    }),
    startWith(false),
    takeUntilDestroyed(this.destroyRef),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  protected readonly policyChanged = toSignal(this.policyChanged$, { initialValue: false });

  constructor(
    @Inject(DIALOG_DATA) protected readonly data: PolicyEditDialogData,
    protected readonly accountService: AccountService,
    protected readonly policyApiService: PolicyApiServiceAbstraction,
    protected readonly i18nService: I18nService,
    protected readonly cdr: ChangeDetectorRef,
    protected readonly formBuilder: FormBuilder,
    protected readonly dialogRef: DialogRef<PolicyEditDialogResult>,
    protected readonly toastService: ToastService,
    protected readonly keyService: KeyService,
    protected readonly dialogService: DialogService,
    protected readonly authService: AuthService,
  ) {}

  get policy(): BasePolicyEditDefinition {
    return this.data.policy;
  }

  /**
   * Shows the success toast after a policy is saved, using the VFO1 policy name when the
   * terminology flag is enabled so it matches the name shown in the policies list.
   */
  protected showEditedPolicyToast(): void {
    const [legacy, next] = policyTitleKeys(this.policy);
    const policyName = this.i18nService.t(this.terminology.enabled() ? next : legacy);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedPolicyId", policyName),
    });
  }

  /** Records the policy form's initial state so that {@link policyChanged$} tracks edits to it. */
  protected trackPolicyChanges(component: BasePolicyEditComponent): void {
    // Run the policy component's ngOnInit and effects so the form is populated before recording
    // its initial state.
    this.cdr.detectChanges();
    this.loadedPolicyComponent$.next(component);
  }

  protected isFormDirty(): boolean {
    const component = this.policyComponent();
    if (!component) {
      return false;
    }
    return component.enabled.dirty || (component.data?.dirty ?? false);
  }

  protected readonly discardDialogOptions = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    type: "danger" as const,
    hideIcon: true,
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "backToEditing" },
  };

  protected setupDiscardGuard(): void {
    this.dialogRef.closePredicate = async (result?: PolicyEditDialogResult) => {
      // A truthy result means an intentional close (e.g. after a successful save) — always allow.
      if (result || !this.isFormDirty()) {
        return true;
      }
      return this.dialogService.openSimpleDialog(this.discardDialogOptions);
    };

    // Guard against browser refresh / tab close while edits are pending.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.guardArmed() && this.isFormDirty()) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    this.destroyRef.onDestroy(() => window.removeEventListener("beforeunload", onBeforeUnload));

    // When the vault is locked or the user is logged out, disarm both guards so neither
    // closePredicate nor beforeunload prompts during the subsequent router teardown.
    // If the active account becomes null (switchAccount(null) during logout), treat that
    // as a non-Unlocked state and disarm as well.
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          if (account?.id == null) {
            return of(null); // no active account — disarm immediately
          }
          return this.authService
            .authStatusFor$(account.id)
            .pipe(filter((status) => status !== AuthenticationStatus.Unlocked));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.guardArmed.set(false);
        this.dialogRef.closePredicate = undefined;
      });
  }

  async load() {
    try {
      return await this.policyApiService.getPolicy(
        this.data.organization.id,
        this.data.policy.type,
      );
    } catch (e: any) {
      // No policy exists yet, instantiate an empty one
      if (e.statusCode === 404) {
        return new PolicyResponse({ Enabled: false });
      } else {
        throw e;
      }
    }
  }

  abstract readonly submit: () => Promise<void>;

  abstract ngAfterViewInit(): Promise<void>;
}

@Component({
  selector: "app-policy-edit-drawer",
  templateUrl: "policy-edit-drawer.component.html",
  imports: [SharedModule, SpinnerComponent, Vfo1I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyEditDrawerComponent extends PolicyEditDialogComponent implements AfterViewInit {
  private readonly policyFormRef = viewChild("policyForm", { read: ViewContainerRef });

  protected readonly policyType = PolicyType;
  protected readonly enabled = false;
  private readonly dataStatus = signal<FormControlStatus>("VALID");
  private readonly canToggleState = signal(true);

  // Disable the Save button if one of the three is true:
  // 1. The policy form has not changed since it was loaded
  // 2. The policy data form is currently invalid
  // 3. The server says the policy cannot be toggled
  protected readonly saveDisabled = computed(
    () => !this.policyChanged() || this.dataStatus() === "INVALID" || !this.canToggleState(),
  );

  readonly formGroup = this.formBuilder.group({
    enabled: [this.enabled],
  });

  constructor(
    @Inject(DIALOG_DATA) data: PolicyEditDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
    cdr: ChangeDetectorRef,
    formBuilder: FormBuilder,
    dialogRef: DialogRef<PolicyEditDialogResult>,
    toastService: ToastService,
    keyService: KeyService,
    dialogService: DialogService,
    authService: AuthService,
  ) {
    super(
      data,
      accountService,
      policyApiService,
      i18nService,
      cdr,
      formBuilder,
      dialogRef,
      toastService,
      keyService,
      dialogService,
      authService,
    );
  }

  /**
   * [legacy, VFO1] i18n key pair for the drawer title.
   */
  get titleKeys(): [string, string] {
    return policyDrawerTitleKeys(this.policy);
  }

  /**
   * [legacy, VFO1] i18n key pair for the drawer body description.
   */
  get descriptionKeys(): [string, string] {
    return policyDrawerDescriptionKeys(this.policy);
  }

  /**
   * [legacy, VFO1] i18n key pair for the prerequisite callout, if one is configured.
   */
  get prerequisiteKeys(): [string, string] | undefined {
    const legacy = this.policy.prerequisiteKey;
    if (!legacy) {
      return undefined;
    }
    return [legacy, this.policy.prerequisiteKeyVfo1 ?? legacy];
  }

  /**
   * [legacy, VFO1] i18n key pair for the warning callout, if one is configured.
   */
  get warningKeys(): [string, string] | undefined {
    const legacy = this.policy.warningKey;
    if (!legacy) {
      return undefined;
    }
    if (this.policy.hideWarningVfo1 && this.terminology.enabled()) {
      return undefined;
    }
    return [legacy, this.policy.warningKeyVfo1 ?? legacy];
  }

  override async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.loading.set(false);
    this.cdr.detectChanges(); // ensure @else branch renders before accessing policyFormRef

    const policyFormRef = this.policyFormRef();
    if (!policyFormRef) {
      throw new Error("Template not initialized.");
    }

    const componentRef = policyFormRef.createComponent(this.getComponentToLoad());
    componentRef.setInput("policy", this.data.policy);
    componentRef.setInput("policyResponse", policyResponse);
    componentRef.setInput("organizationId", this.data.organization.id);
    const component = componentRef.instance;
    this.policyComponent.set(component);
    this.policyEnabled.set(this.data.policy.enabled(policyResponse));
    this.canToggleState.set(policyResponse.canToggleState);

    component.data?.statusChanges
      .pipe(startWith(component.data.status), takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.dataStatus.set(status));

    this.cdr.detectChanges();
    this.setupDiscardGuard();
    this.trackPolicyChanges(component);
  }

  override readonly submit = async () => {
    const policyComponent = this.policyComponent();
    if (!policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    try {
      await this.submitPolicy(policyComponent);

      this.showEditedPolicyToast();
      await this.dialogRef.close("saved");
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  private async submitPolicy(policyComponent: BasePolicyEditComponent): Promise<void> {
    const orgKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
        filter((orgKeys) => orgKeys != null),
        map((orgKeys) => orgKeys[this.data.organization.id] ?? null),
      ),
    );

    if (orgKey == null) {
      throw new Error("No encryption key for this organization.");
    }

    const request = await policyComponent.buildRequest(orgKey);

    await this.policyApiService.putPolicy(
      this.data.organization.id,
      this.data.policy.type,
      request,
    );
  }

  private getComponentToLoad(): Constructor<BasePolicyEditComponent> {
    return this.data.policy.component;
  }

  static readonly openDrawer = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.openDrawer<PolicyEditDialogResult>(PolicyEditDrawerComponent, config);
  };
}
