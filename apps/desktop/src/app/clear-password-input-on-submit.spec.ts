import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { clearPasswordInputOnSubmit } from "./clear-password-input-on-submit";

beforeAll(() => {
  clearPasswordInputOnSubmit(document);
});

describe("clearPasswordInputOnSubmit", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function render(inputType = "password") {
    document.body.innerHTML = `
      <form>
        <input id="pw" type="${inputType}" formcontrolname="masterPassword" />
        <button id="btn" type="submit"></button>
      </form>`;
    return {
      form: document.querySelector("form")!,
      input: document.getElementById("pw") as HTMLInputElement,
      button: document.getElementById("btn") as HTMLButtonElement,
    };
  }

  function submit(form: HTMLFormElement) {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  function typeInto(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("clears and focuses a filled master password input on submit", () => {
    const { form, input, button } = render();
    typeInto(input, "secret");
    button.focus();

    submit(form);

    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("clears the master password input when the visibility toggle made it a text input", () => {
    const { form, input } = render("text");
    typeInto(input, "secret");

    submit(form);

    expect(input.value).toBe("");
  });

  it("clears the DOM value before submit handlers on the form run", () => {
    const { form, input } = render();
    typeInto(input, "secret");
    let valueSeenByHandler: string | undefined;
    form.addEventListener("submit", () => (valueSeenByHandler = input.value));

    submit(form);

    expect(valueSeenByHandler).toBe("");
  });

  it("does not dispatch an input event on the submit that clears the field", () => {
    const { form, input } = render();
    typeInto(input, "secret");
    const onInput = jest.fn();
    input.addEventListener("input", onInput);

    submit(form);

    expect(onInput).not.toHaveBeenCalled();
  });

  it("syncs the form control with the empty field when resubmitted without retyping", () => {
    const { form, input } = render();
    typeInto(input, "secret");
    submit(form);
    const onInput = jest.fn();
    input.addEventListener("input", onInput);
    let inputEventsBeforeHandler: number | undefined;
    form.addEventListener("submit", () => (inputEventsBeforeHandler = onInput.mock.calls.length));

    submit(form);

    expect(inputEventsBeforeHandler).toBe(1);
    expect(input.value).toBe("");
  });

  it("does not sync again once the user has typed into the cleared field", () => {
    const { form, input } = render();
    typeInto(input, "secret");
    submit(form);
    typeInto(input, "");
    const onInput = jest.fn();
    input.addEventListener("input", onInput);

    submit(form);

    expect(onInput).not.toHaveBeenCalled();
  });

  it("clears the retyped value on the next submit", () => {
    const { form, input } = render();
    typeInto(input, "wrong");
    submit(form);
    typeInto(input, "right");

    submit(form);

    expect(input.value).toBe("");
  });

  it("leaves other password inputs alone", () => {
    document.body.innerHTML = `
      <form><input id="pw" type="password" formcontrolname="password" /></form>`;
    const input = document.getElementById("pw") as HTMLInputElement;
    input.value = "item-password";

    submit(document.querySelector("form")!);

    expect(input.value).toBe("item-password");
  });
});

describe("clearPasswordInputOnSubmit with Angular reactive forms", () => {
  @Component({
    template: `
      <form [formGroup]="formGroup" (ngSubmit)="onSubmit()">
        <input type="password" formControlName="masterPassword" />
      </form>
    `,
    imports: [ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class TestFormComponent {
    formGroup!: FormGroup<{ masterPassword: FormControl<string | null> }>;
    submittedValues: (string | null)[] = [];
    validOnSubmit: boolean[] = [];

    onSubmit() {
      this.submittedValues.push(this.formGroup.controls.masterPassword.value);
      this.validOnSubmit.push(this.formGroup.valid);
    }
  }

  function setup(updateOn: "change" | "submit") {
    const fixture = TestBed.createComponent(TestFormComponent);
    fixture.componentInstance.formGroup = new FormGroup({
      masterPassword: new FormControl("", { validators: [Validators.required], updateOn }),
    });
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector("form");
    const input: HTMLInputElement = fixture.nativeElement.querySelector("input");
    const typeInto = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const submit = () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return { component: fixture.componentInstance, input, typeInto, submit };
  }

  describe.each(["change", "submit"] as const)("updateOn: %s", (updateOn) => {
    it("keeps the submitted value in the form control while clearing the field", () => {
      const { component, input, typeInto, submit } = setup(updateOn);
      typeInto("secret");

      submit();

      expect(component.submittedValues).toEqual(["secret"]);
      expect(component.formGroup.controls.masterPassword.value).toBe("secret");
      expect(input.value).toBe("");
    });

    it("fails required validation instead of resubmitting the previous value", () => {
      const { component, typeInto, submit } = setup(updateOn);
      typeInto("secret");
      submit();

      submit();

      expect(component.submittedValues).toEqual(["secret", ""]);
      expect(component.validOnSubmit).toEqual([true, false]);
    });

    it("submits the retyped value after a failed attempt", () => {
      const { component, typeInto, submit } = setup(updateOn);
      typeInto("wrong");
      submit();
      typeInto("right");

      submit();

      expect(component.submittedValues).toEqual(["wrong", "right"]);
    });
  });
});
