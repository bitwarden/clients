import { CommonModule } from "@angular/common";
import { QueryList, Component, ElementRef, OnDestroy, OnInit, ViewChildren } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { enableAccountSwitching } from "../../../platform/flags";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

const BroadcasterSubscriptionId = "excludedDomainsState";

@Component({
  selector: "app-excluded-domains",
  templateUrl: "excluded-domains.component.html",
  standalone: true,
  imports: [
    ButtonModule,
    CardComponent,
    CommonModule,
    FormFieldModule,
    FormsModule,
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
export class ExcludedDomainsComponent implements OnInit, OnDestroy {
  @ViewChildren("uriInput") uriInputElements: QueryList<ElementRef<HTMLInputElement>>;

  accountSwitcherEnabled = false;
  dataIsPristine = true;
  excludedDomainsState: string[] = [];
  storedExcludedDomains: string[] = [];
  // How many fields should be non-editable before editable fields
  fieldsEditThreshold: number = 0;

  constructor(
    private domainSettingsService: DomainSettingsService,
    private i18nService: I18nService,
    private router: Router,
    private broadcasterService: BroadcasterService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.accountSwitcherEnabled = enableAccountSwitching();
  }

  async ngOnInit() {
    const neverDomains = await firstValueFrom(this.domainSettingsService.neverDomains$);

    if (neverDomains) {
      this.storedExcludedDomains = Object.keys(neverDomains);
    }

    this.excludedDomainsState = [...this.storedExcludedDomains];

    // Do not allow the first x (pre-existing) fields to be edited
    this.fieldsEditThreshold = this.storedExcludedDomains.length;

    this.uriInputElements.changes.subscribe(() => {
      this.focusNewUriInput();
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  focusNewUriInput() {
    if (this.uriInputElements?.last?.nativeElement) {
      this.uriInputElements.last.nativeElement.focus();
    }
  }

  async addNewDomain() {
    // add empty field to the Domains list interface
    this.excludedDomainsState.push("");

    await this.fieldChange();
  }

  async removeDomain(i: number) {
    this.excludedDomainsState.splice(i, 1);

    // if a pre-existing field was dropped, lower the edit threshold
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
      await this.router.navigate(["/notifications"]);

      return;
    }

    const newExcludedDomainsSaveState: NeverDomains = {};
    const uniqueExcludedDomains = new Set(this.excludedDomainsState);

    for (const uri of uniqueExcludedDomains) {
      if (uri && uri !== "") {
        const validatedHost = Utils.getHostname(uri);

        if (!validatedHost) {
          this.platformUtilsService.showToast(
            "error",
            null,
            this.i18nService.t("excludedDomainsInvalidDomain", uri),
          );

          return;
        }

        newExcludedDomainsSaveState[validatedHost] = null;
      }
    }

    try {
      await this.domainSettingsService.setNeverDomains(newExcludedDomainsSaveState);

      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("excludedDomainsSavedSuccess"),
      );
    } catch {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("unexpectedError"));

      // Do not navigate on error
      return;
    }

    await this.router.navigate(["/notifications"]);
  }

  trackByFunction(index: number, _: string) {
    return index;
  }
}
