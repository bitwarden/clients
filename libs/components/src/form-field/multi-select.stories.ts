import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
} from "@angular/forms";
import { NgSelectModule } from "@ng-select/ng-select";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BadgeModule } from "../badge";
import { ButtonModule } from "../button";
import { InputModule } from "../input/input.module";
import { MultiSelectComponent } from "../multi-select/multi-select.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FormFieldModule } from "./form-field.module";

export default {
  title: "Component Library/Form/Multi Select",
  excludeStories: /.*Data$/,
  component: MultiSelectComponent,
  decorators: [
    moduleMetadata({
      imports: [
        ButtonModule,
        FormsModule,
        NgSelectModule,
        FormFieldModule,
        InputModule,
        ReactiveFormsModule,
        BadgeModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              multiSelectPlaceholder: "-- Type to Filter --",
              multiSelectLoading: "Retrieving options...",
              multiSelectNotFound: "No items found",
              multiSelectClearAll: "Clear all",
              required: "required",
              inputRequired: "Input is required.",
              loading: "loading",
              removeItem: "remove item",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=13213-55392&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

export const actionsData = {
  onItemsConfirmed: action("onItemsConfirmed"),
};

const fb = new FormBuilder();
const formObjFactory = (isDisabled = false) =>
  fb.group({
    select: fb.control({ value: [], disabled: isDisabled }, { validators: [Validators.required] }),
  });

function submit(formObj: FormGroup) {
  formObj.markAllAsTouched();
}

type Story = StoryObj<MultiSelectComponent & { name: string; hint: string }>;

export const Loading: Story = {
  render: (args) => ({
    props: {
      formObj: formObjFactory(),
      submit: submit,
      ...args,
      onItemsConfirmed: actionsData.onItemsConfirmed,
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit(formObj)">
        <bit-form-field>
          <bit-label>{{ name }}</bit-label>
          <bit-multi-select
            class="tw-w-full"
            formControlName="select"
            [baseItems]="baseItems"
            [removeSelectedItems]="removeSelectedItems"
            [loading]="loading"
            [disabled]="disabled"
            (onItemsConfirmed)="onItemsConfirmed($event)">
          </bit-multi-select>
          <bit-hint>{{ hint }}</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
  args: {
    baseItems: [] as any,
    name: "Loading",
    hint: "This is what a loading multi-select looks like",
    loading: true,
  },
};

export const Disabled: Story = {
  render: (args) => ({
    props: {
      formObj: formObjFactory(true),
      submit: submit,
      ...args,
      onItemsConfirmed: actionsData.onItemsConfirmed,
    },
    template: /*html*/ `
      <form [formGroup]="formObj" (ngSubmit)="submit(formObj)">
        <bit-form-field>
          <bit-label>{{ name }}</bit-label>
          <bit-multi-select
            class="tw-w-full"
            formControlName="select"
            [baseItems]="baseItems"
            [removeSelectedItems]="removeSelectedItems"
            [loading]="loading"
            [disabled]="disabled"
            (onItemsConfirmed)="onItemsConfirmed($event)">
          </bit-multi-select>
          <bit-hint>{{ hint }}</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
  args: {
    baseItems: [] as any,
    name: "Disabled",
    disabled: true,
    hint: "This is what a disabled multi-select looks like",
  },
};

export const Groups: Story = {
  ...Loading,
  args: {
    name: "Select groups",
    hint: "Groups will be assigned to the associated member",
    baseItems: [
      { id: "1", listName: "Group 1", labelName: "Group 1", icon: "bwi-family" },
      { id: "2", listName: "Group 2", labelName: "Group 2", icon: "bwi-family" },
      { id: "3", listName: "Group 3", labelName: "Group 3", icon: "bwi-family" },
      { id: "4", listName: "Group 4", labelName: "Group 4", icon: "bwi-family" },
      { id: "5", listName: "Group 5", labelName: "Group 5", icon: "bwi-family" },
      { id: "6", listName: "Group 6", labelName: "Group 6", icon: "bwi-family" },
      { id: "7", listName: "Group 7", labelName: "Group 7", icon: "bwi-family" },
    ],
  },
};

/**
 * `iconTile` renders a `bit-icon-tile` in place of `icon` in the list. Selected items are rendered as
 * chips, which have no slot for a tile, so they continue to use `icon`.
 */
export const IconTiles: Story = {
  ...Loading,
  args: {
    name: "Select item types",
    hint: "Item types will be included in the export",
    baseItems: [
      {
        id: "1",
        listName: "Login",
        labelName: "Login",
        icon: "bwi-globe",
        iconTile: { icon: "bwi-globe", variant: "brand" },
      },
      {
        id: "2",
        listName: "Card",
        labelName: "Card",
        icon: "bwi-credit-card",
        iconTile: { icon: "bwi-credit-card", variant: "teal" },
      },
      {
        id: "3",
        listName: "Identity",
        labelName: "Identity",
        icon: "bwi-id-card",
        iconTile: { icon: "bwi-id-card", variant: "purple", emphasis: "bold" },
      },
      {
        id: "4",
        listName: "Note with a custom color",
        labelName: "Note",
        icon: "bwi-sticky-note",
        iconTile: { icon: "bwi-sticky-note", color: "#f8e71c" },
      },
      {
        id: "5",
        listName: "SSH key",
        labelName: "SSH key",
        icon: "bwi-key",
        iconTile: { icon: "bwi-key", variant: "green" },
      },
    ],
  },
};

export const Members: Story = {
  ...Loading,
  args: {
    name: "Select members",
    hint: "Members will be assigned to the associated group/shared folder",
    baseItems: [
      { id: "1", listName: "Joe Smith (jsmith@mail.me)", labelName: "Joe Smith", icon: "bwi-user" },
      {
        id: "2",
        listName: "Tania Stone (tstone@mail.me)",
        labelName: "Tania Stone",
        icon: "bwi-user",
      },
      {
        id: "3",
        listName: "Matt Matters (mmatters@mail.me)",
        labelName: "Matt Matters",
        icon: "bwi-user",
      },
      {
        id: "4",
        listName: "Bob Robertson (brobertson@mail.me)",
        labelName: "Bob Robertson",
        icon: "bwi-user",
      },
      {
        id: "5",
        listName: "Ashley Fletcher (aflectcher@mail.me)",
        labelName: "Ashley Fletcher",
        icon: "bwi-user",
      },
      {
        id: "6",
        listName: "Rita Olson (rolson@mail.me)",
        labelName: "Rita Olson",
        icon: "bwi-user",
      },
      {
        id: "7",
        listName: "Final listName (fname@mail.me)",
        labelName: "Final listName (fname@mail.me)",
        icon: "bwi-user",
      },
    ],
  },
};

export const SharedFolders: Story = {
  ...Loading,
  args: {
    name: "Select shared folders",
    hint: "Shared folders will be assigned to the associated member",
    baseItems: [
      {
        id: "1",
        listName: "Shared Folder 1",
        labelName: "Shared Folder 1",
        icon: "bwi-shared-folder",
      },
      {
        id: "2",
        listName: "Shared Folder 2",
        labelName: "Shared Folder 2",
        icon: "bwi-shared-folder",
      },
      {
        id: "3",
        listName: "Shared Folder 3",
        labelName: "Shared Folder 3",
        icon: "bwi-shared-folder",
      },
      {
        id: "3.5",
        listName: "Child Shared Folder 1 for Parent 1",
        labelName: "Child Shared Folder 1 for Parent 1",
        icon: "bwi-shared-folder",
        parentGrouping: "Parent 1",
      },
      {
        id: "3.55",
        listName: "Child Shared Folder 2 for Parent 1",
        labelName: "Child Shared Folder 2 for Parent 1",
        icon: "bwi-shared-folder",
        parentGrouping: "Parent 1",
      },
      {
        id: "3.59",
        listName: "Child Shared Folder 3 for Parent 1",
        labelName: "Child Shared Folder 3 for Parent 1",
        icon: "bwi-shared-folder",
        parentGrouping: "Parent 1",
      },
      {
        id: "3.75",
        listName: "Child Shared Folder 1 for Parent 2",
        labelName: "Child Shared Folder 1 for Parent 2",
        icon: "bwi-shared-folder",
        parentGrouping: "Parent 2",
      },
      {
        id: "4",
        listName: "Shared Folder 4",
        labelName: "Shared Folder 4",
        icon: "bwi-shared-folder",
      },
      {
        id: "5",
        listName: "Shared Folder 5",
        labelName: "Shared Folder 5",
        icon: "bwi-shared-folder",
      },
      {
        id: "6",
        listName: "Shared Folder 6",
        labelName: "Shared Folder 6",
        icon: "bwi-shared-folder",
      },
      {
        id: "7",
        listName: "Shared Folder 7",
        labelName: "Shared Folder 7",
        icon: "bwi-shared-folder",
      },
    ],
  },
};

export const MembersAndGroups: Story = {
  ...Loading,
  args: {
    name: "Select groups and members",
    hint: "Members/Groups will be assigned to the associated shared folder",
    baseItems: [
      { id: "1", listName: "Group 1", labelName: "Group 1", icon: "bwi-family" },
      { id: "2", listName: "Group 2", labelName: "Group 2", icon: "bwi-family" },
      { id: "3", listName: "Group 3", labelName: "Group 3", icon: "bwi-family" },
      { id: "4", listName: "Group 4", labelName: "Group 4", icon: "bwi-family" },
      { id: "5", listName: "Group 5", labelName: "Group 5", icon: "bwi-family" },
      { id: "6", listName: "Joe Smith (jsmith@mail.me)", labelName: "Joe Smith", icon: "bwi-user" },
      {
        id: "7",
        listName: "Tania Stone (tstone@mail.me)",
        labelName: "(tstone@mail.me)",
        icon: "bwi-user",
      },
    ],
  },
};

export const RemoveSelected: Story = {
  ...Loading,
  args: {
    name: "Select groups",
    hint: "Groups will be removed from the list once the dropdown is closed",
    baseItems: [
      { id: "1", listName: "Group 1", labelName: "Group 1", icon: "bwi-family" },
      { id: "2", listName: "Group 2", labelName: "Group 2", icon: "bwi-family" },
      { id: "3", listName: "Group 3", labelName: "Group 3", icon: "bwi-family" },
      { id: "4", listName: "Group 4", labelName: "Group 4", icon: "bwi-family" },
      { id: "5", listName: "Group 5", labelName: "Group 5", icon: "bwi-family" },
      { id: "6", listName: "Group 6", labelName: "Group 6", icon: "bwi-family" },
      { id: "7", listName: "Group 7", labelName: "Group 7", icon: "bwi-family" },
    ],
    removeSelectedItems: true,
  },
};
