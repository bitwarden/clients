// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormArray, FormBuilder, FormControl, FormGroup } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UpdateDomainsRequest } from "@bitwarden/common/models/request/update-domains.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { HeaderModule } from "../layouts/header/header.module";
import { SharedModule } from "../shared";

@Component({
  selector: "app-domain-rules",
  templateUrl: "domain-rules.component.html",
  imports: [SharedModule, HeaderModule],
})
export class DomainRulesComponent implements OnInit {
  loading = true;
  custom: string[] = [];
  global: any[] = [];
  formPromise: Promise<any>;
  formGroup: FormGroup<{ customDomain: FormArray<FormControl<any>> }> = this.formBuilder.group({
    customDomain: this.formBuilder.array([]),
  });
  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private formBuilder: FormBuilder,
  ) {}

  async ngOnInit() {
    const response = await this.apiService.getSettingsDomains();
    this.loading = false;
    if (response.equivalentDomains != null) {
      this.custom = response.equivalentDomains.map((d) => d.join(", "));
    }
    if (response.globalEquivalentDomains != null) {
      this.global = response.globalEquivalentDomains.map((d) => {
        return {
          domains: d.domains.join(", "),
          excluded: d.excluded,
          key: d.type,
        };
      });
    }
    this.patch();
  }
  patch() {
    const control = <FormArray>this.formGroup.get("customDomain");
    control.clear();
    this.custom.forEach((val, index) => {
      control.insert(index, this.patchValues(val));
    });
    this.formGroup.updateValueAndValidity();
  }
  patchValues(customDomain: string) {
    return this.formBuilder.group({
      domain: [customDomain],
    });
  }
  toggleExcluded(globalDomain: any) {
    globalDomain.excluded = !globalDomain.excluded;
  }

  customize(globalDomain: any) {
    globalDomain.excluded = true;
    this.custom.push(globalDomain.domains);
    this.patch();
  }

  remove(index: number) {
    this.custom.splice(index, 1);
    this.patch();
  }

  add() {
    this.custom.push("");
    this.patch();
  }

  submit = async () => {
    const customDomainValues = this.formGroup.get("customDomain").value;
    this.custom = customDomainValues.map((d) => d.domain);
    const request = new UpdateDomainsRequest();
    request.excludedGlobalEquivalentDomains = this.global
      .filter((d) => d.excluded)
      .map((d) => d.key);
    if (request.excludedGlobalEquivalentDomains.length === 0) {
      request.excludedGlobalEquivalentDomains = null;
    }
    request.equivalentDomains = this.custom
      .filter((d) => d != null && d.trim() !== "")
      .map((d) => d.split(",").map((d2) => d2.trim()));
    if (request.equivalentDomains.length === 0) {
      request.equivalentDomains = null;
    }

    await this.apiService.putSettingsDomains(request);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("domainsUpdated"));
  };

  indexTrackBy(index: number, obj: any): any {
    return index;
  }
}
