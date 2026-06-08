import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Constructor } from "type-fest";

import { DialogConfig, DialogService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { BasePolicyEditComponent } from "./base-policy-edit.component";
import { PolicyEditDialogComponent } from "./policy-edit-dialog.component";
import type { PolicyEditDialogData, PolicyEditDialogResult } from "./policy-edit-dialog.component";

@Component({
  templateUrl: "policy-edit-drawer.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyEditDrawerComponent extends PolicyEditDialogComponent {
  protected override getComponentToLoad(): Constructor<BasePolicyEditComponent> {
    return this.data.policy.v2?.component ?? this.data.policy.component;
  }

  static readonly openDrawer = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.openDrawer<PolicyEditDialogResult>(PolicyEditDrawerComponent, config);
  };
}
