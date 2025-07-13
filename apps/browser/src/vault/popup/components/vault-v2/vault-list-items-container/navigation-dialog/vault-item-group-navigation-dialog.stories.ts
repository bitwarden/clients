import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { VaultItemGroupNavigationDialogComponent } from "./vault-item-group-navigation-dialog.component";

export default {
  title: "Browser/Vault/Item Group Navigation Dialog",
  component: VaultItemGroupNavigationDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              keyboardNavigationBehavior: "Keyboard navigation behavior",
              keyboardNavigationBehaviorUpDown:
                "Use up/down arrow keys (↑ ↓) to move between items",
              keyboardNavigationBehaviorRightLeft:
                "Use right/left arrow keys (→ ←) to move between item actions",
              keyboardNavigationBehaviorTab:
                "Use tab key (↹) to jump to the next focusable section on the page",
              gotIt: "Got it",
            }),
        },
      ],
    }),
    applicationConfig({
      providers: [provideNoopAnimations()],
    }),
  ],
} as Meta<VaultItemGroupNavigationDialogComponent>;

export const Default: StoryObj<VaultItemGroupNavigationDialogComponent> = {};
