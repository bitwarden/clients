import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import {
  GeneratorActive,
  GeneratorInactive,
  HealthActive,
  HealthInactive,
  SendActive,
  SendInactive,
  SettingsActive,
  SettingsInactive,
  VaultActive,
  VaultInactive,
} from "@bitwarden/assets/svg";

import type { BitBottomNavigation, BottomNavigationButton } from "./bottom-navigation";
import "./bottom-navigation";

const navButtons = (showBerry = false): BottomNavigationButton[] => [
  { label: "vault", href: "#/tabs/vault", icon: VaultInactive, iconActive: VaultActive },
  {
    label: "generator",
    href: "#/tabs/generator",
    icon: GeneratorInactive,
    iconActive: GeneratorActive,
  },
  { label: "send", href: "#/tabs/send", icon: SendInactive, iconActive: SendActive },
  { label: "health", href: "#/tabs/health", icon: HealthInactive, iconActive: HealthActive },
  {
    label: "settings",
    href: "#/tabs/settings",
    icon: SettingsInactive,
    iconActive: SettingsActive,
    showBerry,
  },
];

type Args = { navButtons: BottomNavigationButton[] };

/** Simulates a router: clicking a button marks it active and shows its page. */
function selectPage(event: MouseEvent) {
  const link = event
    .composedPath()
    .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
  if (!link) {
    return;
  }
  event.preventDefault();
  const nav = event.currentTarget as BitBottomNavigation;
  const href = link.getAttribute("href");
  nav.navButtons = nav.navButtons.map((button) => ({ ...button, active: button.href === href }));
  const page = nav.parentElement?.querySelector("[data-page]");
  const current = nav.navButtons.find((button) => button.active);
  if (page && current) {
    page.textContent = `${current.label} page`;
  }
}

export default {
  title: "Component Library/Bottom Navigation",
  component: "bit-bottom-navigation",
  render: (args) => html`
    <div
      class="tw-h-[640px] tw-w-[480px] tw-flex tw-flex-col tw-border tw-border-solid tw-border-secondary-300"
    >
      <div class="tw-flex-1 tw-overflow-y-auto">
        <div class="tw-p-4 tw-text-main" data-page>vault page</div>
      </div>
      <bit-bottom-navigation
        .navButtons=${args.navButtons.map((button, i) => ({ ...button, active: i === 0 }))}
        @click=${selectPage}
      ></bit-bottom-navigation>
    </div>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = { args: { navButtons: navButtons() } };

export const WithBerry: Story = { args: { navButtons: navButtons(true) } };
