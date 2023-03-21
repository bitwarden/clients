import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProviderService } from "@bitwarden/common/abstractions/provider.service";
import { ValidationService } from "@bitwarden/common/abstractions/validation.service";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { Provider } from "@bitwarden/common/models/domain/provider";
import { Guid } from "@bitwarden/common/types/guid";

import { WebProviderService } from "../services/webProvider.service";

@Component({
  selector: "provider-add-organization",
  templateUrl: "add-organization.component.html",
})
export class AddOrganizationComponent implements OnInit {
  @Input() providerId: Guid;
  @Input() organizations: Organization[];
  @Output() onAddedOrganization = new EventEmitter();

  provider: Provider;
  formPromise: Promise<any>;
  loading = true;

  constructor(
    private providerService: ProviderService,
    private webProviderService: WebProviderService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private validationService: ValidationService
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    if (this.providerId == null) {
      return;
    }

    this.provider = await this.providerService.get(this.providerId);

    this.loading = false;
  }

  async add(organization: Organization) {
    if (this.formPromise) {
      return;
    }

    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t("addOrganizationConfirmation", organization.name, this.provider.name),
      organization.name,
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );

    if (!confirmed) {
      return false;
    }

    try {
      this.formPromise = this.webProviderService.addOrganizationToProvider(
        this.providerId,
        organization.id
      );
      await this.formPromise;
    } catch (e) {
      this.validationService.showError(e);
      return;
    } finally {
      this.formPromise = null;
    }

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("organizationJoinedProvider")
    );
    this.onAddedOrganization.emit();
  }
}
