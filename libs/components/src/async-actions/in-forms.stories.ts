import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule, ReactiveFormsModule, Validators, FormBuilder } from "@angular/forms";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { delay, of } from "rxjs";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { A11yTitleDirective } from "../a11y";
import { ButtonModule } from "../button";
import { FormFieldModule } from "../form-field";
import { IconButtonModule } from "../icon-button";
import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { AsyncActionsModule } from "./async-actions.module";
import { BitActionDirective } from "./bit-action.directive";
import { BitSubmitDirective } from "./bit-submit.directive";
import { BitFormButtonDirective } from "./form-button.directive";

const template = `
  <form [formGroup]="formObj" [bitSubmit]="submit">
    <bit-form-field>
      <bit-label>Name</bit-label>
      <input bitInput formControlName="name" />
    </bit-form-field>

    <bit-form-field>
      <bit-label>Email</bit-label>
      <input bitInput formControlName="email" />
      <button type="button" label="Refresh" bitSuffix bitIconButton="bwi-refresh" bitFormButton [bitAction]="refresh"></button>
    </bit-form-field>

    <button class="tw-me-2" type="submit" buttonType="primary" bitButton bitFormButton>Submit</button>
    <button class="tw-me-2" type="button" buttonType="secondary" bitButton bitFormButton>Cancel</button>
    <button class="tw-me-2" type="button" buttonType="danger" bitButton bitFormButton [bitAction]="delete">Delete</button>
    <button class="tw-me-2" type="button" buttonType="secondary" bitButton bitFormButton [disabled]="true">Inactive</button>
    <button class="tw-me-2" type="button" buttonType="primaryGhost" bitIconButton="bwi-trash" label="Delete" bitFormButton [bitAction]="delete"></button>
  </form>`;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-promise-example",
  template,
  imports: [
    A11yTitleDirective,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    ReactiveFormsModule,
  ],
})
class PromiseExampleComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly formObj = this.formBuilder.group({
    name: ["", [Validators.required]],
    email: ["", [Validators.required, Validators.email]],
  });

  readonly refresh = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 2000);
    });
  };

  readonly submit = async () => {
    this.formObj.markAllAsTouched();

    if (!this.formObj.valid) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 2000);
    });
  };

  readonly delete = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 2000);
    });
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-observable-example",
  template,
  imports: [
    A11yTitleDirective,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    ReactiveFormsModule,
  ],
})
class ObservableExampleComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly formObj = this.formBuilder.group({
    name: ["", [Validators.required]],
    email: ["", [Validators.required, Validators.email]],
  });

  readonly refresh = () => {
    return of("fake observable").pipe(delay(2000));
  };

  readonly submit = () => {
    this.formObj.markAllAsTouched();

    if (!this.formObj.valid) {
      return undefined;
    }

    return of("fake observable").pipe(delay(2000));
  };

  readonly delete = () => {
    return of("fake observable").pipe(delay(2000));
  };
}

export default {
  title: "Component Library/Async Actions/In Forms",
  decorators: [
    moduleMetadata({
      imports: [
        BitSubmitDirective,
        BitFormButtonDirective,
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        ButtonModule,
        IconButtonModule,
        BitActionDirective,
        PromiseExampleComponent,
        ObservableExampleComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              required: "required",
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email-address.",
              loading: "Loading",
            });
          },
        },
        {
          provide: ValidationService,
          useValue: {
            showError: action("ValidationService.showError"),
          } as Partial<ValidationService>,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PromiseExampleComponent>;

export const UsingPromise: Story = {
  render: (args) => ({
    props: args,
    template: `<app-promise-example></app-promise-example>`,
  }),
};

export const UsingObservable: Story = {
  render: (args) => ({
    props: args,
    template: `<app-observable-example></app-observable-example>`,
  }),
};
