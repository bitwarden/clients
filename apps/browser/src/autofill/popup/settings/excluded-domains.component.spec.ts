import { FormBuilder } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { ExcludedDomainsComponent } from "./excluded-domains.component";

describe("ExcludedDomainsComponent", () => {
  let domainSettingsService: MockProxy<DomainSettingsService>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let component: ExcludedDomainsComponent;

  beforeEach(() => {
    domainSettingsService = mock<DomainSettingsService>();
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();

    component = new ExcludedDomainsComponent(
      domainSettingsService,
      i18nService,
      toastService,
      new FormBuilder(),
      mock<PopupRouterCacheService>(),
    );
    component.dataIsPristine = false;
  });

  async function save(...entries: string[]) {
    for (const entry of entries) {
      await component.addNewDomain();
      component.domainForms.at(-1).setValue(entry);
    }
    await component.saveChanges();
  }

  it("saves an IPv4 CIDR range as typed", async () => {
    await save("192.0.2.0/24", "https://example.com/login");

    expect(domainSettingsService.setNeverDomains).toHaveBeenCalledWith({
      "192.0.2.0/24": null,
      "example.com": null,
    });
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it.each(["192.0.2.0/33", "192.0.2.0/24/1", "256.0.0.0/8"])(
    "rejects %s without saving",
    async (entry) => {
      await save("example.com", entry);

      expect(domainSettingsService.setNeverDomains).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    },
  );
});
