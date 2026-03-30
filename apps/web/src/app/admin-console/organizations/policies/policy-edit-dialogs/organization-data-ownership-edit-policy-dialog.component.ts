import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  signal,
  TemplateRef,
  viewChild,
  WritableSignal,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import {
  catchError,
  combineLatest,
  defer,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../../shared";
import { vNextOrganizationDataOwnershipPolicyComponent } from "../policy-edit-definitions";
import {
  PolicyEditDialogComponent,
  PolicyEditDialogData,
  PolicyEditDialogResult,
} from "../policy-edit-dialog.component";

import { MultiStepSubmit } from "./models";

/**
 * Custom policy dialog component for Centralize Organization Data
 * Ownership policy. Satisfies the PolicyDialogComponent interface
 * structurally via its static open() function.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "organization-data-ownership-edit-policy-dialog.component.html",
  imports: [SharedModule],
})
export class OrganizationDataOwnershipPolicyDialogComponent
  extends PolicyEditDialogComponent
  implements AfterViewInit
{
  policyType = PolicyType;

  protected centralizeDataOwnershipEnabled$: Observable<boolean> = defer(() =>
    from(
      this.policyApiService.getPolicy(
        this.data.organization.id,
        PolicyType.OrganizationDataOwnership,
      ),
    ).pipe(
      map((policy) => policy.enabled),
      catchError(() => of(false)),
    ),
  );

  protected readonly currentStep: WritableSignal<number> = signal(0);
  protected readonly multiStepSubmit: WritableSignal<MultiStepSubmit[]> = signal([]);

  private readonly policyForm = viewChild.required<TemplateRef<unknown>>("step0");
  private readonly policyFormTitle = viewChild.required<TemplateRef<unknown>>("step0Title");

  protected saveDisabled$: Observable<boolean> | undefined;

  private get typedPolicyComponent(): vNextOrganizationDataOwnershipPolicyComponent | undefined {
    const component = this.policyComponent();
    return component instanceof vNextOrganizationDataOwnershipPolicyComponent
      ? component
      : undefined;
  }

  constructor(
    @Inject(DIALOG_DATA) protected data: PolicyEditDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
    cdr: ChangeDetectorRef,
    formBuilder: FormBuilder,
    dialogRef: DialogRef<PolicyEditDialogResult>,
    toastService: ToastService,
    protected keyService: KeyService,
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
    );
  }

  async ngAfterViewInit() {
    await super.ngAfterViewInit();

    const typedComponent = this.typedPolicyComponent;
    if (typedComponent) {
      this.saveDisabled$ = combineLatest([
        this.centralizeDataOwnershipEnabled$,
        typedComponent.enabled.valueChanges.pipe(startWith(typedComponent.enabled.value)),
      ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));
    }

    this.multiStepSubmit.set(this.buildMultiStepSubmit());
  }

  private buildMultiStepSubmit(): MultiStepSubmit[] {
    return [
      {
        sideEffect: () => this.handleSubmit(),
        footerContent: this.policyForm,
        titleContent: this.policyFormTitle,
      },
    ];
  }

  private async handleSubmit() {
    const typedComponent = this.typedPolicyComponent;
    if (!typedComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    const orgKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
      ),
    );

    assertNonNullish(orgKey, "Org key not provided");

    const request = await typedComponent.buildVNextRequest(orgKey[this.data.organization.id]);

    await this.policyApiService.putPolicyVNext(
      this.data.organization.id,
      this.data.policy.type,
      request,
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
    });

    if (!typedComponent.enabled.value) {
      this.dialogRef.close("saved");
    }
  }

  submit = async () => {
    const typedComponent = this.typedPolicyComponent;
    if (!typedComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    if ((await typedComponent.confirm()) == false) {
      this.dialogRef.close();
      return;
    }

    try {
      const sideEffect = this.multiStepSubmit()[this.currentStep()].sideEffect;
      if (sideEffect) {
        await sideEffect();
      }

      if (this.currentStep() === this.multiStepSubmit().length - 1) {
        this.dialogRef.close("saved");
        return;
      }

      this.currentStep.update((value) => value + 1);
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  static open = (dialogService: DialogService, config: DialogConfig<PolicyEditDialogData>) => {
    return dialogService.open<PolicyEditDialogResult>(
      OrganizationDataOwnershipPolicyDialogComponent,
      config,
    );
  };
}
