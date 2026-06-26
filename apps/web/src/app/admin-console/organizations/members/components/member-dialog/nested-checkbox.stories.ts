import { importProvidersFrom } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { CheckboxModule, FormFieldModule } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { NestedCheckboxComponent } from "./nested-checkbox.component";

export default {
  title: "Web/Organizations/Members/Nested Checkbox",
  decorators: [
    moduleMetadata({
      imports: [NestedCheckboxComponent, ReactiveFormsModule, CheckboxModule, FormFieldModule],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<NestedCheckboxComponent>;

const makeGroup = (parentChecked: boolean, childValues: boolean[]) =>
  new FormGroup({
    manageAllCollections: new FormControl<boolean>(parentChecked, { nonNullable: true }),
    createNewCollections: new FormControl<boolean>(childValues[0], { nonNullable: true }),
    editAnyCollection: new FormControl<boolean>(childValues[1], { nonNullable: true }),
    deleteAnyCollection: new FormControl<boolean>(childValues[2], { nonNullable: true }),
  } as Record<string, FormControl<boolean>>);

export const AllUnchecked: Story = {
  render: () => ({
    props: {
      parentId: "manageAllCollections",
      checkboxes: makeGroup(false, [false, false, false]),
    },
    template: `
      <app-nested-checkbox
        parentId="manageAllCollections"
        [checkboxes]="checkboxes"
      ></app-nested-checkbox>
    `,
  }),
};

export const AllChecked: Story = {
  render: () => ({
    props: {
      parentId: "manageAllCollections",
      checkboxes: makeGroup(true, [true, true, true]),
    },
    template: `
      <app-nested-checkbox
        parentId="manageAllCollections"
        [checkboxes]="checkboxes"
      ></app-nested-checkbox>
    `,
  }),
};

export const Indeterminate: Story = {
  render: () => ({
    props: {
      parentId: "manageAllCollections",
      checkboxes: makeGroup(false, [true, false, false]),
    },
    template: `
      <app-nested-checkbox
        parentId="manageAllCollections"
        [checkboxes]="checkboxes"
      ></app-nested-checkbox>
    `,
  }),
};
