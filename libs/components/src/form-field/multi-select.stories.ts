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
import { SharedModule } from "../shared";
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
        SharedModule,
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

export const Members: Story = {
  ...Loading,
  args: {
    name: "Select members",
    hint: "Members will be assigned to the associated group/collection",
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

export const Collections: Story = {
  ...Loading,
  args: {
    name: "Select collections",
    hint: "Collections will be assigned to the associated member",
    baseItems: [
      {
        id: "1",
        listName: "Collection 1",
        labelName: "Collection 1",
        icon: "bwi-collection-shared",
      },
      {
        id: "2",
        listName: "Collection 2",
        labelName: "Collection 2",
        icon: "bwi-collection-shared",
      },
      {
        id: "3",
        listName: "Collection 3",
        labelName: "Collection 3",
        icon: "bwi-collection-shared",
      },
      {
        id: "3.5",
        listName: "Child Collection 1 for Parent 1",
        labelName: "Child Collection 1 for Parent 1",
        icon: "bwi-collection-shared",
        parentGrouping: "Parent 1",
      },
      {
        id: "3.55",
        listName: "Child Collection 2 for Parent 1",
        labelName: "Child Collection 2 for Parent 1",
        icon: "bwi-collection-shared",
        parentGrouping: "Parent 1",
      },
      {
        id: "3.59",
        listName: "Child Collection 3 for Parent 1",
        labelName: "Child Collection 3 for Parent 1",
        icon: "bwi-collection-shared",
        parentGrouping: "Parent 1",
      },
      {
        id: "3.75",
        listName: "Child Collection 1 for Parent 2",
        labelName: "Child Collection 1 for Parent 2",
        icon: "bwi-collection-shared",
        parentGrouping: "Parent 2",
      },
      {
        id: "4",
        listName: "Collection 4",
        labelName: "Collection 4",
        icon: "bwi-collection-shared",
      },
      {
        id: "5",
        listName: "Collection 5",
        labelName: "Collection 5",
        icon: "bwi-collection-shared",
      },
      {
        id: "6",
        listName: "Collection 6",
        labelName: "Collection 6",
        icon: "bwi-collection-shared",
      },
      {
        id: "7",
        listName: "Collection 7",
        labelName: "Collection 7",
        icon: "bwi-collection-shared",
      },
    ],
  },
};

export const MembersAndGroups: Story = {
  ...Loading,
  args: {
    name: "Select groups and members",
    hint: "Members/Groups will be assigned to the associated collection",
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
