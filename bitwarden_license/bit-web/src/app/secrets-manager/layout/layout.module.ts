import { NgModule } from "@angular/core";

import { OrgSwitcherComponent } from "@bitwarden/web-vault/app/layouts/org-switcher/org-switcher.component";
import { WebLayoutModule } from "@bitwarden/web-vault/app/layouts/web-layout.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

import { LayoutComponent } from "./layout.component";
import { NavigationComponent } from "./navigation.component";

@NgModule({
  imports: [SharedModule, WebLayoutModule, OrgSwitcherComponent],
  declarations: [LayoutComponent, NavigationComponent],
})
export class LayoutModule {}
