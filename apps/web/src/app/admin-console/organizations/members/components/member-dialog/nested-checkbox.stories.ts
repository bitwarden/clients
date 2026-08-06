import { importProvidersFrom } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { NestedCheckboxComponent } from "./nested-checkbox.component";

type StoryArgs = {
  /** Toggles the vfo1-foundation flag - "Collection" labels become "Shared folder" labels. */
  vfo1FoundationEnabled: boolean;
};

export default {
  title: "Admin Console/Organizations/Members/Nested Checkbox",
  argTypes: {
    vfo1FoundationEnabled: {
      control: "boolean",
      description: 'Toggle the vfo1-foundation flag ("Collection" → "Shared folder" labels).',
      name: "Shared folder terminology (flag on)",
    },
  },
  args: {
    vfo1FoundationEnabled: false,
  },
  decorators: [
    moduleMetadata({
      imports: [NestedCheckboxComponent, ReactiveFormsModule, CheckboxModule, FormFieldModule],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

const makeGroup = (parentChecked: boolean, childValues: boolean[]) =>
  new FormGroup({
    manageAllCollections: new FormControl<boolean>(parentChecked, { nonNullable: true }),
    createNewCollections: new FormControl<boolean>(childValues[0], { nonNullable: true }),
    editAnyCollection: new FormControl<boolean>(childValues[1], { nonNullable: true }),
    deleteAnyCollection: new FormControl<boolean>(childValues[2], { nonNullable: true }),
  } as Record<string, FormControl<boolean>>);

function makeRender(parentChecked: boolean, childValues: boolean[]): Story["render"] {
  return ({ vfo1FoundationEnabled }) => ({
    moduleMetadata: {
      providers: [
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => vfo1FoundationEnabled },
        },
      ],
    },
    props: {
      parentId: "manageAllCollections",
      checkboxes: makeGroup(parentChecked, childValues),
    },
    template: `
      <app-nested-checkbox
        parentId="manageAllCollections"
        [checkboxes]="checkboxes"
      ></app-nested-checkbox>
    `,
  });
}

export const AllUnchecked: Story = {
  render: makeRender(false, [false, false, false]),
};

export const AllChecked: Story = {
  render: makeRender(true, [true, true, true]),
};

export const Indeterminate: Story = {
  render: makeRender(false, [true, false, false]),
};
