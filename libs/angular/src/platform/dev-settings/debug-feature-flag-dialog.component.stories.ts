import { computed, signal } from "@angular/core";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { DefaultFeatureFlagValue, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { DebugFeatureFlagDialogComponent } from "./debug-feature-flag-dialog.component";
import { DebugFeatureFlagDialogService, FlagEntry } from "./debug-feature-flag-dialog.service";

function createMockService(
  enabledFlags: FeatureFlag[] = [],
): Partial<DebugFeatureFlagDialogService> {
  const flags: FlagEntry[] = Object.entries(FeatureFlag)
    .filter(([, key]) => typeof DefaultFeatureFlagValue[key as FeatureFlag] === "boolean")
    .map(([name, key]) => ({
      name,
      key: key as FeatureFlag,
      value: signal(enabledFlags.includes(key as FeatureFlag)),
    }));

  const search = signal("");
  const loaded = signal(true);
  const filteredFlags = computed(() => {
    const q = search().toLowerCase().trim();
    if (!q) {
      return flags;
    }
    return flags.filter((f) => f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
  });

  return {
    flags,
    loaded,
    search,
    filteredFlags,
    initialize: () => Promise.resolve(),
    onToggle: (flag: FlagEntry, value: boolean) => {
      flag.value.set(value);
      return Promise.resolve();
    },
    resetAll: () => {
      flags.forEach((f) => f.value.set(false));
      return Promise.resolve();
    },
  };
}

export default {
  title: "Platform/Debug Feature Flag Dialog",
  component: DebugFeatureFlagDialogComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: DebugFeatureFlagDialogService, useValue: createMockService() },
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({ search: "Search", resetSearch: "Clear" }),
        },
      ],
    }),
  ],
} as Meta<DebugFeatureFlagDialogComponent>;

type Story = StoryObj<DebugFeatureFlagDialogComponent>;

/** All flags reported as off (server default). */
export const Default: Story = {};

/** Some flags pre-enabled to show the toggled-on state. */
export const WithSomeFlagsEnabled: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: DebugFeatureFlagDialogService,
          useValue: createMockService([
            FeatureFlag.AutoConfirm,
            FeatureFlag.SafariAccountSwitching,
            FeatureFlag.SSHAgentV2,
          ]),
        },
      ],
    }),
  ],
};
