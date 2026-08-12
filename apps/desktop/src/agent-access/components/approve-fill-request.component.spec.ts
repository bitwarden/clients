import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { CredentialLoginMatch } from "./approve-credential-request.component";
import {
  ApproveFillRequestComponent,
  ApproveFillRequestParams,
  ApproveFillRequestResult,
} from "./approve-fill-request.component";

function makeMatch(overrides: Partial<CredentialLoginMatch> = {}): CredentialLoginMatch {
  return {
    kind: "credential",
    cipherId: "c1",
    cipherName: "Example",
    username: "user@example.com",
    fieldsShared: { username: true, password: true, totp: false, uri: false },
    ...overrides,
  };
}

function makeParams(overrides: Partial<ApproveFillRequestParams> = {}): ApproveFillRequestParams {
  return {
    requesterName: "Cursor",
    origin: "https://example.com",
    matches: [makeMatch()],
    fieldPlan: [
      { role: "username", target: "input#email (login form)" },
      { role: "password", target: "input[type=password]#pw" },
    ],
    skipped: [],
    ...overrides,
  };
}

describe("ApproveFillRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ApproveFillRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  /** Instantiates the component directly (matching ApproveCredentialRequestComponent's spec
   *  style) rather than rendering the full template — avoids bringing in every Bitwarden dialog
   *  chrome dependency just to exercise the picker/validation logic. */
  function createComponent(params: ApproveFillRequestParams): ApproveFillRequestComponent {
    mockDialogRef = mock<DialogRef<ApproveFillRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ApproveFillRequestComponent());
  }

  describe("origin", () => {
    it("exposes the extension-reported origin for the template's dominant element", () => {
      const component = createComponent(makeParams({ origin: "https://bitnotes.io" }));

      expect(component["params"].origin).toBe("https://bitnotes.io");
    });
  });

  describe("single match", () => {
    it("preselects the only match and does not require a selection", () => {
      const match = makeMatch();
      const component = createComponent(makeParams({ matches: [match] }));

      expect(component["hasMultipleMatches"]).toBe(false);
      expect(component["approveFillRequestForm"].valid).toBe(true);
      expect(component["selectedMatch"]()).toEqual(match);
    });

    it("approves the single match on submit", async () => {
      const component = createComponent(makeParams());

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c1" });
    });
  });

  describe("multiple matches (picker)", () => {
    const matches = [
      makeMatch({ cipherId: "c1", cipherName: "GitHub", username: "personal@example.com" }),
      makeMatch({ cipherId: "c2", cipherName: "GitHub", username: "work@example.com" }),
    ];

    it("requires a selection and does not close the dialog until one is made", async () => {
      const component = createComponent(makeParams({ matches }));

      expect(component["hasMultipleMatches"]).toBe(true);
      expect(component["approveFillRequestForm"].valid).toBe(false);

      await component.submit();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("approves only the selected cipher id on submit", async () => {
      const component = createComponent(makeParams({ matches }));
      component["approveFillRequestForm"].patchValue({ selectedId: "c2" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c2" });
    });

    it("tracks the highlighted match as the radio selection changes", () => {
      const component = createComponent(makeParams({ matches }));

      component["approveFillRequestForm"].patchValue({ selectedId: "c2" });

      expect(component["selectedMatch"]()?.cipherId).toBe("c2");
    });
  });

  describe("field plan", () => {
    it("exposes the planned roles with their target descriptors and localized role labels", () => {
      const component = createComponent(
        makeParams({
          fieldPlan: [
            { role: "username", target: "input#email (login form)" },
            { role: "totp", target: "input#otp (login form)" },
          ],
          skipped: [{ role: "password", reason: "no-password-field" }],
        }),
      );

      expect(component["params"].fieldPlan).toEqual([
        { role: "username", target: "input#email (login form)" },
        { role: "totp", target: "input#otp (login form)" },
      ]);
      expect(component["params"].skipped).toEqual([
        { role: "password", reason: "no-password-field" },
      ]);
      // Role labels resolve through i18n (totp renders as the verification-code label).
      expect(component["roleLabel"]("username")).toBe("username");
      expect(component["roleLabel"]("totp")).toBe("verificationCode");
    });
  });

  describe("deny", () => {
    it("closes with approved: false", async () => {
      const component = createComponent(makeParams());

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });

  describe("requesterDisplayName", () => {
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent(
        makeParams({ requesterName: undefined, requesterFingerprint: "abcdef123456" }),
      );

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });

    it("falls back to the unknown-application i18n string when neither name nor fingerprint is present", () => {
      const component = createComponent(
        makeParams({ requesterName: undefined, requesterFingerprint: undefined }),
      );

      expect(component["requesterDisplayName"]).toBe("agentAccessUnknownApplication");
    });
  });
});
