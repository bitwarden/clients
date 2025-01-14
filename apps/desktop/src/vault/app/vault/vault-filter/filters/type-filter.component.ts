import { Component, OnInit } from "@angular/core";

import { TypeFilterComponent as BaseTypeFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/type-filter.component";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
})
export class TypeFilterComponent extends BaseTypeFilterComponent implements OnInit {
  isSshKeysEnabled = false;

  constructor(private configService: ConfigService) {
    super();
  }

  async ngOnInit(): Promise<void> {
    this.isSshKeysEnabled = await this.configService.getFeatureFlag(FeatureFlag.SSHKeyVaultItem);
  }
}
