import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { Vfo1TerminologyService } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { CollectionAccessRestrictedComponent } from "./collection-access-restricted.component";

const mockVfo1TerminologyService = {
  enabled: () => false,
  iconClass: (icon: string) => icon,
};

export default {
  title: "Admin Console/Organizations/Collections/Collection Access Restricted",
  component: CollectionAccessRestrictedComponent,
  decorators: [
    moduleMetadata({
      imports: [CollectionAccessRestrictedComponent],
      providers: [{ provide: Vfo1TerminologyService, useValue: mockVfo1TerminologyService }],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<CollectionAccessRestrictedComponent>;

type Story = StoryObj<CollectionAccessRestrictedComponent>;

/**
 * The member can edit the collection — shows the "Edit collection" button.
 */
export const CanEdit: Story = {
  args: {
    canEditCollection: true,
    canViewCollectionInfo: false,
  },
};

/**
 * The member can only view collection access — shows the "View access" button instead of an
 * edit action.
 */
export const CanViewAccessOnly: Story = {
  args: {
    canEditCollection: false,
    canViewCollectionInfo: true,
  },
};
