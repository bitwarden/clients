import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";
import {
  createAutofillFieldMock,
  createAutofillPageDetailsMock,
  createAutofillScriptMock,
} from "../spec/autofill-mocks";
import {
  flushPromises,
  mockQuerySelectorAllDefinedCall,
  sendMockExtensionMessage,
} from "../spec/testing-utils";
import { FormFieldElement } from "../types";

let pageDetailsMock: AutofillPageDetails;
let fillScriptMock: AutofillScript;
let autofillFieldElementByOpidMock: FormFieldElement;

jest.mock("../services/collect-autofill-content.service", () => {
  const module = jest.requireActual("../services/collect-autofill-content.service");
  return {
    CollectAutofillContentService: class extends module.CollectAutofillContentService {
      async getPageDetails(): Promise<AutofillPageDetails> {
        return pageDetailsMock;
      }

      getAutofillFieldElementByOpid(opid: string) {
        const mockedEl = autofillFieldElementByOpidMock;
        if (mockedEl) {
          autofillFieldElementByOpidMock = null;
          return mockedEl;
        }

        return Array.from(document.querySelectorAll(`*`)).find(
          (el) => (el as any).opid === opid,
        ) as FormFieldElement;
      }
    },
  };
});
jest.mock("../services/insert-autofill-content.service");

describe("AutoSubmitLogin content script", () => {
  const mockQuerySelectorAll = mockQuerySelectorAllDefinedCall();

  beforeEach(() => {
    jest.useFakeTimers();
    setupEnvironmentDefaults();
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./auto-submit-login");
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.clearAllMocks();
    mockQuerySelectorAll.mockRestore();
  });

  it("ends the auto-submit login workflow if the page does not contain any fields", async () => {
    pageDetailsMock.fields = [];

    await initAutoSubmitWorkflow();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        command: "updateIsFieldCurrentlyFilling",
        isFieldCurrentlyFilling: false,
      },
      expect.any(Function),
    );
  });

  describe("when the page contains form fields", () => {
    it("ends the auto-submit login workflow if the provided fill script does not contain an autosubmit value", async () => {
      await initAutoSubmitWorkflow();

      sendMockExtensionMessage({
        command: "triggerAutoSubmitLogin",
        fillScript: fillScriptMock,
        pageDetailsUrl: globalThis.location.href,
      });
      await flushPromises();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          command: "updateIsFieldCurrentlyFilling",
          isFieldCurrentlyFilling: false,
        },
        expect.any(Function),
      );
    });

    describe("triggering auto-submit on formless fields", () => {
      beforeEach(async () => {
        pageDetailsMock.fields = [
          createAutofillFieldMock({ htmlID: "username", formOpid: null, opid: "name-field" }),
          createAutofillFieldMock({
            htmlID: "password",
            type: "password",
            formOpid: null,
            opid: "password-field",
          }),
        ];
        fillScriptMock = createAutofillScriptMock(
          {
            autosubmit: [null],
          },
          { "name-field": "name-value", "password-field": "password-value" },
        );
        document.body.innerHTML = `
          <div>
            <div>
              <label for="username">Username</label>
              <input type="text" id="username" name="username">
            </div>
            <div>
              <label for="password">Password</label>
              <input type="password" id="password" name="password">
            </div>
          </div>
          <div class="submit-container">
            <input type="submit" value="Submit">
          </div>
        `;
        const passwordElement = document.getElementById("password") as HTMLInputElement;
        (passwordElement as any).opid = "password-field";
        await initAutoSubmitWorkflow();
      });

      it("triggers the submit action on an element that contains a type=Submit attribute", async () => {
        const submitButton = document.querySelector(
          ".submit-container input[type=submit]",
        ) as HTMLInputElement;
        jest.spyOn(submitButton, "click");

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(submitButton.click).toHaveBeenCalled();
      });

      it("triggers the submit action on a button element if a type=Submit element does not exist", async () => {
        const submitButton = document.createElement("button");
        submitButton.innerHTML = "Submit";
        const submitContainer = document.querySelector(".submit-container");
        submitContainer.innerHTML = "";
        submitContainer.appendChild(submitButton);
        jest.spyOn(submitButton, "click");

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(submitButton.click).toHaveBeenCalled();
      });

      it("triggers the submit action when the field is within a shadow root", async () => {
        createFormlessShadowRootFields();
        const submitButton = document.querySelector("input[type=submit]") as HTMLInputElement;
        jest.spyOn(submitButton, "click");

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(submitButton.click).toHaveBeenCalled();
      });
    });

    describe("triggering auto-submit on a form", () => {
      beforeEach(async () => {
        pageDetailsMock.fields = [
          createAutofillFieldMock({
            htmlID: "username",
            formOpid: "__form0__",
            opid: "name-field",
          }),
          createAutofillFieldMock({
            htmlID: "password",
            type: "password",
            formOpid: "__form0__",
            opid: "password-field",
          }),
        ];
        fillScriptMock = createAutofillScriptMock(
          {
            autosubmit: ["__form0__"],
          },
          { "name-field": "name-value", "password-field": "password-value" },
        );
        document.body.innerHTML = `
          <form>
            <div>
              <div>
                <label for="username">Username</label>
                <input type="text" id="username" name="username">
              </div>
              <div>
                <label for="password">Password</label>
                <input type="password" id="password" name="password">
              </div>
            </div>
            <div class="submit-container">
              <input type="submit" value="Submit">
            </div>
          </form>
        `;
        const formElement = document.querySelector("form") as HTMLFormElement;
        (formElement as any).opid = "__form0__";
        formElement.addEventListener("submit", (e) => e.preventDefault());
        const passwordElement = document.getElementById("password") as HTMLInputElement;
        (passwordElement as any).opid = "password-field";
        await initAutoSubmitWorkflow();
      });

      it("attempts to trigger submission of the element as a formless field if the form cannot be found by opid", async () => {
        const formElement = document.querySelector("form") as HTMLFormElement;
        (formElement as any).opid = "__form1__";
        const submitButton = document.querySelector(
          ".submit-container input[type=submit]",
        ) as HTMLInputElement;
        jest.spyOn(submitButton, "click");

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(submitButton.click).toHaveBeenCalled();
      });

      it("triggers the submit action on an element that contains a type=Submit attribute", async () => {
        const submitButton = document.querySelector(
          ".submit-container input[type=submit]",
        ) as HTMLInputElement;
        jest.spyOn(submitButton, "click");

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(submitButton.click).toHaveBeenCalled();
      });

      it("triggers the form's requestSubmit method when the form does not contain an button to allow submission", async () => {
        const submitButton = document.querySelector(
          ".submit-container input[type=submit]",
        ) as HTMLInputElement;
        submitButton.remove();
        const formElement = document.querySelector("form") as HTMLFormElement;
        jest.spyOn(formElement, "requestSubmit").mockImplementation();

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(formElement.requestSubmit).toHaveBeenCalled();
      });

      it("triggers the form's submit method when the requestSubmit method is not available", async () => {
        const submitButton = document.querySelector(
          ".submit-container input[type=submit]",
        ) as HTMLInputElement;
        submitButton.remove();
        const formElement = document.querySelector("form") as HTMLFormElement;
        formElement.requestSubmit = undefined;
        jest.spyOn(formElement, "submit").mockImplementation();

        sendMockExtensionMessage({
          command: "triggerAutoSubmitLogin",
          fillScript: fillScriptMock,
          pageDetailsUrl: globalThis.location.href,
        });
        await flushPromises();

        expect(formElement.submit).toHaveBeenCalled();
      });
    });
  });
});

function setupEnvironmentDefaults() {
  document.body.innerHTML = ``;
  pageDetailsMock = createAutofillPageDetailsMock();
  fillScriptMock = createAutofillScriptMock();
}

async function initAutoSubmitWorkflow() {
  jest.advanceTimersByTime(250);
  await flushPromises();
}

function createFormlessShadowRootFields() {
  document.body.innerHTML = ``;
  const wrapper = document.createElement("div");
  const usernameShadowRoot = document.createElement("div");
  usernameShadowRoot.attachShadow({ mode: "open" });
  usernameShadowRoot.shadowRoot.innerHTML = `<input type="text" id="username" name="username">`;
  const passwordShadowRoot = document.createElement("div");
  passwordShadowRoot.attachShadow({ mode: "open" });
  const passwordElement = document.createElement("input");
  passwordElement.type = "password";
  passwordElement.id = "password";
  passwordElement.name = "password";
  (passwordElement as any).opid = "password-field";
  autofillFieldElementByOpidMock = passwordElement;
  passwordShadowRoot.shadowRoot.appendChild(passwordElement);
  const normalSubmitButton = document.createElement("input");
  normalSubmitButton.type = "submit";

  wrapper.appendChild(usernameShadowRoot);
  wrapper.appendChild(passwordShadowRoot);
  wrapper.appendChild(normalSubmitButton);
  document.body.appendChild(wrapper);
}
