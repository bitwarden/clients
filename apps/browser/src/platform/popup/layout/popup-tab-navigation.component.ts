import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { IconModule, LinkModule } from "@bitwarden/components";

import { GeneratorActive, GeneratorInactive } from "./icons/generator";
import { SendActive, SendInactive } from "./icons/send";
import { SettingsActive, SettingsInactive } from "./icons/settings";
import { VaultInactive, VaultActive } from "./icons/vault";

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  standalone: true,
  imports: [CommonModule, LinkModule, RouterModule, JslibModule, IconModule],
  host: {
    class: "tw-block tw-h-full tw-w-full tw-flex tw-flex-col",
  },
})
export class PopupTabNavigationComponent {
  navButtons = [
    {
      label: "vault",
      page: "/tabs/vault",
      iconKey: VaultInactive,
      iconKeyActive: VaultActive,
    },
    {
      label: "generator",
      page: "/tabs/generator",
      iconKey: GeneratorInactive,
      iconKeyActive: GeneratorActive,
    },
    {
      label: "send",
      page: "/tabs/send",
      iconKey: SendInactive,
      iconKeyActive: SendActive,
    },
    {
      label: "settings",
      page: "/tabs/settings",
      iconKey: SettingsInactive,
      iconKeyActive: SettingsActive,
    },
  ];
}
