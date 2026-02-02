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
import { OrganizationId } from "@bitwarden/common/types/guid";
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
        this.data.organizationId,
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
  private readonly warningContent = viewChild.required<TemplateRef<unknown>>("step1");
  private readonly policyFormTitle = viewChild.required<TemplateRef<unknown>>("step0Title");
  private readonly warningTitle = viewChild.required<TemplateRef<unknown>>("step1Title");

  override policyComponent: vNextOrganizationDataOwnershipPolicyComponent | undefined;

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

    if (this.policyComponent) {
      this.saveDisabled$ = combineLatest([
        this.centralizeDataOwnershipEnabled$,
        this.policyComponent.enabled.valueChanges.pipe(
          startWith(this.policyComponent.enabled.value),
        ),
      ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));
    }

    this.multiStepSubmit.set(this.buildMultiStepSubmit());
  }

  private buildMultiStepSubmit(): MultiStepSubmit[] {
    if (this.policyComponent?.policyResponse?.enabled) {
      return [
        {
          sideEffect: () => this.handleSubmit(),
          footerContent: this.policyForm,
          titleContent: this.policyFormTitle,
        },
      ];
    }

    return [
      {
        footerContent: this.policyForm,
        titleContent: this.policyFormTitle,
      },
      {
        sideEffect: () => this.handleSubmit(),
        footerContent: this.warningContent,
        titleContent: this.warningTitle,
      },
    ];
  }

  private async handleSubmit() {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    const orgKey = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
      ),
    );

    assertNonNullish(orgKey, "Org key not provided");

    const request = await this.policyComponent.buildVNextRequest(
      orgKey[this.data.organizationId as OrganizationId],
    );

    await this.policyApiService.putPolicyVNext(
      this.data.organizationId,
      this.data.policy.type,
      request,
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
    });

    if (!this.policyComponent.enabled.value) {
      this.dialogRef.close("saved");
    }
  }

  submit = async () => {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    if ((await this.policyComponent.confirm()) == false) {
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
      this.policyComponent.setStep(this.currentStep());
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
