import { CommonModule } from "@angular/common";
import {
  QueryList,
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  ViewChildren,
} from "@angular/core";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
} from "@angular/forms";
import { RouterModule } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { AutofillTargetingRulesByDomain } from "@bitwarden/common/autofill/types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

@Component({
  selector: "autofill-targeting-rules",
  templateUrl: "autofill-targeting-rules.component.html",
  imports: [
    ButtonModule,
    CardComponent,
    CommonModule,
    FormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    IconButtonModule,
    ItemModule,
    JslibModule,
    LinkModule,
    PopOutComponent,
    PopupFooterComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class AutofillTargetingRulesComponent implements AfterViewInit, OnDestroy {
  @ViewChildren("uriInput") uriInputElements: QueryList<ElementRef<HTMLInputElement>> =
    new QueryList();

  dataIsPristine = true;
  isLoading = false;
  /** Source-of-truth state from the service used to populate the view state */
  storedTargetingRulesState: AutofillTargetingRulesByDomain = {};
  /** Key names for the view state properties */
  viewTargetingRulesDomains: string[] = [];
  /** Tentative, unsaved state used to populate the view */
  targetingRulesDomainsViewState: AutofillTargetingRulesByDomain = {};

  protected domainListForm = new FormGroup({
    domains: this.formBuilder.array([]),
  });

  // How many fields should be non-editable before editable fields
  fieldsEditThreshold: number = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private domainSettingsService: DomainSettingsService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private formBuilder: FormBuilder,
    private popupRouterCacheService: PopupRouterCacheService,
  ) {}

  get domainForms() {
    return this.domainListForm.get("domains") as FormArray;
  }

  async ngAfterViewInit() {
    this.domainSettingsService.autofillTargetingRules$
      .pipe(takeUntil(this.destroy$))
      .subscribe((targetingRulesSet: AutofillTargetingRulesByDomain) =>
        this.handleStateUpdate(targetingRulesSet),
      );

    this.uriInputElements.changes.pipe(takeUntil(this.destroy$)).subscribe(({ last }) => {
      this.focusNewUriInput(last);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Handles changes to the service state */
  handleStateUpdate(targetingRulesSet: AutofillTargetingRulesByDomain) {
    if (targetingRulesSet) {
      this.storedTargetingRulesState = { ...targetingRulesSet };
      this.viewTargetingRulesDomains = Object.keys(targetingRulesSet);
      this.targetingRulesDomainsViewState = { ...targetingRulesSet };
    }

    // Do not allow the first x (pre-existing) fields to be edited
    this.fieldsEditThreshold = this.viewTargetingRulesDomains.length;

    this.dataIsPristine = true;
    this.isLoading = false;
  }

  focusNewUriInput(elementRef: ElementRef) {
    if (elementRef?.nativeElement) {
      elementRef.nativeElement.focus();
    }
  }

  async addNewDomain() {
    this.domainForms.push(
      this.formBuilder.group({
        domain: null,
        username: null,
        password: null,
        totp: null,
      }),
    );

    await this.fieldChange();
  }

  async removeDomain(i: number) {
    const removedDomainName = this.viewTargetingRulesDomains[i];
    this.viewTargetingRulesDomains.splice(i, 1);
    delete this.targetingRulesDomainsViewState[removedDomainName];

    // If a pre-existing field was dropped, lower the edit threshold
    if (i < this.fieldsEditThreshold) {
      this.fieldsEditThreshold--;
    }

    await this.fieldChange();
  }

  async fieldChange() {
    if (this.dataIsPristine) {
      this.dataIsPristine = false;
    }
  }

  async saveChanges() {
    if (this.dataIsPristine) {
      return;
    }

    this.isLoading = true;

    const newUriTargetingRulesSaveState: AutofillTargetingRulesByDomain = {
      ...this.targetingRulesDomainsViewState,
    };

    // Then process form values
    this.domainForms.controls.forEach((control) => {
      const formGroup = control as FormGroup;
      const domain = formGroup.get("domain")?.value;

      const normalizedURI = this.domainSettingsService.normalizeAutofillTargetingURI(domain);

      if (!normalizedURI) {
        this.toastService.showToast({
          message: this.i18nService.t("blockedDomainsInvalidDomain", domain),
          title: "",
          variant: "error",
        });
        return;
      }

      const enteredUsername = formGroup.get("username")?.value;
      const enteredPassword = formGroup.get("password")?.value;
      const enteredTotp = formGroup.get("totp")?.value;

      if (!enteredUsername && !enteredPassword && !enteredTotp) {
        this.toastService.showToast({
          message: "No targeting rules were specified for the URL",
          title: "",
          variant: "error",
        });

        return;
      }

      newUriTargetingRulesSaveState[normalizedURI] = {};

      // Only add the property to the object if it has a value
      if (enteredUsername) {
        newUriTargetingRulesSaveState[normalizedURI].username = enteredUsername;
      }

      if (enteredPassword) {
        newUriTargetingRulesSaveState[normalizedURI].password = enteredPassword;
      }

      if (enteredTotp) {
        newUriTargetingRulesSaveState[normalizedURI].totp = enteredTotp;
      }
    });

    try {
      const existingStateKeys = Object.keys(this.storedTargetingRulesState);
      const newStateKeys = Object.keys(newUriTargetingRulesSaveState);

      // Check if any domains were added or removed
      const domainsChanged =
        new Set([...existingStateKeys, ...newStateKeys]).size !== existingStateKeys.length;

      // Check if any domain's properties were modified
      const propertiesChanged = existingStateKeys.some((domain) => {
        const oldRules = this.storedTargetingRulesState[domain];
        const newRules = newUriTargetingRulesSaveState[domain];

        // Check if any properties were added, removed, or modified
        return (
          !oldRules ||
          !newRules ||
          oldRules.username !== newRules.username ||
          oldRules.password !== newRules.password ||
          oldRules.totp !== newRules.totp
        );
      });

      const stateIsChanged = domainsChanged || propertiesChanged;

      if (stateIsChanged) {
        await this.domainSettingsService.setAutofillTargetingRules(newUriTargetingRulesSaveState);
      } else {
        this.handleStateUpdate(this.storedTargetingRulesState);
      }

      this.toastService.showToast({
        message: this.i18nService.t("blockedDomainsSavedSuccess"),
        title: "",
        variant: "success",
      });

      this.domainForms.clear();
    } catch {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        title: "",
        variant: "error",
      });
      this.isLoading = false;
    }
  }

  async goBack() {
    await this.popupRouterCacheService.back();
  }

  trackByFunction(index: number, _: string) {
    return index;
  }
}
