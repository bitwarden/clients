import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LinkModule } from "@bitwarden/components";

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  standalone: true,
  imports: [CommonModule, LinkModule, RouterModule, JslibModule],
  host: {
    class: "tw-block tw-h-full tw-w-full tw-flex tw-flex-col",
  },
})
export class PopupTabNavigationComponent {
  navButtons = [
    {
      label: "vault",
      page: "/tabs/vault",
      iconKey: "lock",
      iconKeyActive: "lock-f",
    },
    {
      label: "generator",
      page: "/tabs/generator",
      iconKey: "generate",
      iconKeyActive: "generate-f",
    },
    {
      label: "send",
      page: "/tabs/send",
      iconKey: "send",
      iconKeyActive: "send-f",
    },
    {
      label: "settings",
      page: "/tabs/settings",
      iconKey: "cog",
      iconKeyActive: "cog-f",
    },
  ];
}
