// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TextFieldModule } from "@angular/cdk/text-field";
import { Directive, ElementRef, Input, OnInit, Renderer2 } from "@angular/core";
import {
  AbstractControl,
  UntypedFormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AsyncActionsModule } from "../async-actions";
import { BadgeModule } from "../badge";
import { ButtonModule } from "../button";
import { CardComponent } from "../card";
import { CheckboxModule } from "../checkbox";
import { IconButtonModule } from "../icon-button";
import { InputModule } from "../input/input.module";
import { LinkModule } from "../link";
import { RadioButtonModule } from "../radio-button";
import { SectionComponent } from "../section";
import { SelectModule } from "../select";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BitFormFieldComponent } from "./form-field.component";
import { FormFieldModule } from "./form-field.module";

// TOOD: This solves a circular dependency between components and angular.
@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective implements OnInit {
  @Input() set appA11yTitle(title: string) {
    this.title = title;
    this.setAttributes();
  }

  private title: string;
  private originalTitle: string | null;
  private originalAriaLabel: string | null;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.originalTitle = this.el.nativeElement.getAttribute("title");
    this.originalAriaLabel = this.el.nativeElement.getAttribute("aria-label");
    this.setAttributes();
  }

  private setAttributes() {
    if (this.originalTitle === null) {
      this.renderer.setAttribute(this.el.nativeElement, "title", this.title);
    }
    if (this.originalAriaLabel === null) {
      this.renderer.setAttribute(this.el.nativeElement, "aria-label", this.title);
    }
  }
}

export default {
  title: "Component Library/Form/Field",
  component: BitFormFieldComponent,
  decorators: [
    moduleMetadata({
      imports: [
        A11yTitleDirective,
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
        ButtonModule,
        IconButtonModule,
        AsyncActionsModule,
        CheckboxModule,
        RadioButtonModule,
        SelectModule,
        LinkModule,
        CardComponent,
        SectionComponent,
        TextFieldModule,
        BadgeModule,
        A11yTitleDirective,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              selectPlaceholder: "-- Select --",
              required: "required",
              inputRequired: "Input is required.",
              inputEmail: "Input is not an email-address.",
              toggleVisibility: "Toggle visibility",
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

const fb = new UntypedFormBuilder();
const formObj = fb.group({
  test: [""],
  required: ["", [Validators.required]],
});

const defaultFormObj = fb.group({
  name: ["", [Validators.required]],
  email: ["", [Validators.required, Validators.email, forbiddenNameValidator(/bit/i)]],
  terms: [false, [Validators.requiredTrue]],
  updates: ["yes"],
  file: [""],
});

// Custom error message, `message` is shown as the error message
function forbiddenNameValidator(nameRe: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const forbidden = nameRe.test(control.value);
    return forbidden ? { forbiddenName: { message: "forbiddenName" } } : null;
  };
}

function submit() {
  defaultFormObj.markAllAsTouched();
}
type Story = StoryObj<BitFormFieldComponent>;

export const Default: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>Label</bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
};

export const LabelWithIcon: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>
            Label
            <a href="#" slot="end" bitLink aria-label="More info" title="More info">
              <i class="bwi bwi-question-circle" aria-hidden="true"></i>
            </a>
          </bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
};

export const LongLabel: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj" style="width: 200px">
        <bit-form-field>
          <bit-label>
            Hello I am a very long label with lots of very cool helpful information
          </bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
        <bit-form-field>
          <bit-label>
            Hello I am a very long label with lots of very cool helpful information
            <a href="#" slot="end" bitLink aria-label="More info" title="More info">
              <i class="bwi bwi-question-circle" aria-hidden="true"></i>
            </a>
          </bit-label>
          <input bitInput formControlName="name" />
          <bit-hint>Optional Hint</bit-hint>
        </bit-form-field>
      </form>
    `,
  }),
};

export const Required: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput required placeholder="Placeholder" />
      </bit-form-field>

      <bit-form-field [formGroup]="formObj">
        <bit-label>FormControl</bit-label>
        <input bitInput formControlName="required" placeholder="Placeholder" />
      </bit-form-field>
    `,
  }),
};

export const Hint: Story = {
  render: (args) => ({
    props: {
      formObj: formObj,
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>FormControl</bit-label>
        <input bitInput formControlName="required" placeholder="Placeholder" />
        <bit-hint>Long hint text</bit-hint>
      </bit-form-field>
    `,
  }),
};

export const Disabled: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" disabled />
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Readonly: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Input</bit-label>
        <input bitInput value="Foobar" readonly />
      </bit-form-field>

      <bit-form-field>
        <bit-label>Input</bit-label>
        <input bitInput type="password" value="Foobar" [readonly]="true" />
        <button type="button" bitIconButton bitSuffix bitPasswordInputToggle></button>
        <button type="button" bitSuffix bitIconButton="bwi-clone" [appA11yTitle]="'Clone Input'"></button>
      </bit-form-field>

      <bit-form-field>
        <bit-label>Textarea</bit-label>
        <textarea bitInput rows="4" readonly>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</textarea>
      </bit-form-field>

      <div class="tw-p-4 tw-mt-10 tw-border-2 tw-border-solid tw-border-black tw-bg-background-alt">
        <h2 bitTypography="h2">Inside card</h2>
        <bit-section>
          <bit-card>
            <bit-form-field>
              <bit-label>Input</bit-label>
              <input bitInput value="Foobar" readonly />
            </bit-form-field>

            <bit-form-field>
              <bit-label>Input</bit-label>
              <input bitInput type="password" value="Foobar" readonly />
              <button type="button" bitIconButton bitSuffix bitPasswordInputToggle></button>
              <button type="button" bitSuffix bitIconButton="bwi-clone" [appA11yTitle]="'Clone Input'"></button>
            </bit-form-field>

            <bit-form-field>
              <bit-label>Textarea <span slot="end" bitBadge variant="success">Premium</span></bit-label>
              <textarea bitInput rows="3" readonly class="tw-resize-none">Row1
Row2
Row3</textarea>
            </bit-form-field>

            <bit-form-field disableMargin disableReadOnlyBorder>
              <bit-label>Sans margin & border</bit-label>
              <input bitInput value="Foobar" readonly />
            </bit-form-field>
          </bit-card>
        </bit-section>
      </div>
    `,
  }),
  args: {},
};

export const InputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" />
        <span bitPrefix>$</span>
        <span bitSuffix>USD</span>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const ButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>
          Label
          <a href="#" slot="end" bitLink [appA11yTitle]="'More info'">
            <i class="bwi bwi-question-circle" aria-hidden="true"></i>
          </a>
        </bit-label>
        <button bitPrefix bitIconButton="bwi-star" [appA11yTitle]="'Favorite Label'"></button>
        <input bitInput placeholder="Placeholder" />
        <button bitSuffix bitIconButton="bwi-eye" [appA11yTitle]="'Hide Label'"></button>
        <button bitSuffix bitIconButton="bwi-clone" [appA11yTitle]="'Clone Label'"></button>
        <button bitSuffix bitLink>
          Apply
        </button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const DisabledButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <button bitPrefix bitIconButton="bwi-star" disabled [appA11yTitle]="'Favorite Label'"></button>
        <input bitInput placeholder="Placeholder" disabled />
        <button bitSuffix bitIconButton="bwi-eye" disabled [appA11yTitle]="'Hide Label'"></button>
        <button bitSuffix bitIconButton="bwi-clone" disabled [appA11yTitle]="'Clone Label'"></button>
        <button bitSuffix bitLink disabled>
          Apply
        </button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const PartiallyDisabledButtonInputGroup: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <input bitInput placeholder="Placeholder" disabled />
        <button bitSuffix bitIconButton="bwi-eye" [appA11yTitle]="'Hide Label'"></button>
        <button bitSuffix bitIconButton="bwi-clone" [appA11yTitle]="'Clone Label'"></button>
        <button bitSuffix bitLink disabled>
          Apply
        </button>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const Select: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Label</bit-label>
        <select bitInput>
          <option>Select</option>
          <option>Other</option>
        </select>
      </bit-form-field>
    `,
  }),
  args: {},
};

export const AdvancedSelect: Story = {
  render: (args) => ({
    props: {
      formObj: fb.group({
        select: "value1",
      }),
      ...args,
    },
    template: /*html*/ `
      <bit-form-field [formGroup]="formObj">
        <bit-label>Label</bit-label>
        <bit-select formControlName="select">
          <bit-option label="Select" value="value1"></bit-option>
          <bit-option label="Other" value="value2"></bit-option>
        </bit-select>
      </bit-form-field>
    `,
  }),
};

export const FileInput: Story = {
  render: (args) => ({
    props: {
      formObj: defaultFormObj,
      submit: submit,
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
        <bit-form-field>
          <bit-label>File</bit-label>
          <div class="tw-text-main">
            <button bitButton type="button" buttonType="secondary">
              Choose File
            </button>
            No file chosen
          </div>
          <input
            bitInput
            #fileSelector
            type="file"
            formControlName="file"
            hidden
          />
        </bit-form-field>
      </form>
    `,
  }),
};

export const Textarea: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-form-field>
        <bit-label>Textarea</bit-label>
        <textarea bitInput rows="4"></textarea>
      </bit-form-field>
    `,
  }),
  args: {},
};
