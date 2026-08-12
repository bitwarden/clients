import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { CredentialQueryType } from "../models/credential-query-type";

import {
  ApproveCredentialRequestComponent,
  ApproveCredentialRequestParams,
  ApproveCredentialRequestResult,
  CredentialLoginMatch,
  CredentialMatch,
  SecretMatch,
} from "./approve-credential-request.component";

function makeMatch(overrides: Partial<CredentialLoginMatch> = {}): CredentialLoginMatch {
  return {
    kind: "credential",
    cipherId: "c1",
    cipherName: "Example",
    username: "user@example.com",
    fieldsShared: { username: true, password: true, totp: false, uri: true },
    ...overrides,
  };
}

function makeSecretMatch(overrides: Partial<SecretMatch> = {}): SecretMatch {
  return {
    kind: "secret",
    secretId: "s1",
    secretName: "DB_PASSWORD",
    organizationName: "Acme Inc",
    ...overrides,
  };
}

describe("ApproveCredentialRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ApproveCredentialRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  /** Instantiates the component directly (matching AgentAccessPairAgentDialogComponent's spec
   *  style) rather than rendering the full template — avoids bringing in every Bitwarden dialog
   *  chrome dependency just to exercise the picker/validation logic. */
  function createComponent(
    params: ApproveCredentialRequestParams,
  ): ApproveCredentialRequestComponent {
    mockDialogRef = mock<DialogRef<ApproveCredentialRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ApproveCredentialRequestComponent());
  }

  describe("single match", () => {
    it("preselects the only match and does not require a selection", () => {
      const match = makeMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [match],
      });

      expect(component["hasMultipleMatches"]).toBe(false);
      expect(component["approveCredentialRequestForm"].valid).toBe(true);
      expect(component["selectedMatch"]()).toEqual(match);
    });

    it("approves the single match on submit", async () => {
      const match = makeMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [match],
      });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c1" });
    });
  });

  describe("multiple matches", () => {
    function createMultiMatchComponent(): {
      component: ApproveCredentialRequestComponent;
      matches: CredentialMatch[];
    } {
      const matches = [
        makeMatch({ cipherId: "c1", cipherName: "GitHub (work)", username: "work@example.com" }),
        makeMatch({
          cipherId: "c2",
          cipherName: "GitHub (personal)",
          username: "personal@example.com",
        }),
      ];
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "github",
        matches,
      });
      return { component, matches };
    }

    it("requires a selection and does not close the dialog until one is made", async () => {
      const { component } = createMultiMatchComponent();

      expect(component["hasMultipleMatches"]).toBe(true);
      expect(component["approveCredentialRequestForm"].valid).toBe(false);
      expect(component["selectedMatch"]()).toBeUndefined();

      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("tracks the highlighted match as the radio selection changes", () => {
      const { component, matches } = createMultiMatchComponent();

      component["approveCredentialRequestForm"].patchValue({ selectedId: "c2" });

      expect(component["selectedMatch"]()).toEqual(matches[1]);
    });

    it("approves only the selected cipher id on submit", async () => {
      const { component } = createMultiMatchComponent();
      component["approveCredentialRequestForm"].patchValue({ selectedId: "c2" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c2" });
    });
  });

  // The dialog's reference-mode reassurance copy (see the component's `isReferenceMode`) hinges
  // on `params.deliveryMode` — these cover it reading true only for an explicit "reference" value
  // and false for every other case, including inject mode and an absent delivery mode (a secret
  // request, or a relay-origin credential request, carries none).
  describe("isReferenceMode", () => {
    it("is true for an explicit reference delivery mode", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        deliveryMode: "reference",
        matches: [makeMatch()],
      });

      expect(component["isReferenceMode"]).toBe(true);
    });

    it("is false for inject delivery mode", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        deliveryMode: "inject",
        matches: [makeMatch()],
      });

      expect(component["isReferenceMode"]).toBe(false);
    });

    it("is false when no delivery mode is present (secret requests, and relay-origin credential requests)", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
      });

      expect(component["isReferenceMode"]).toBe(false);
    });
  });

  describe("deny", () => {
    it("closes with approved: false", async () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
      });

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });

  describe("requesterDisplayName", () => {
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
      });

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });

    it("falls back to the unknown-application i18n string, without throwing, when both requesterName and requesterFingerprint are absent", () => {
      // Regression test: `requesterFingerprint` is optional (a local-origin request never
      // carries one), and the dialog used to call `.slice(0, 6)` on it unconditionally, throwing
      // during construction and silently killing the request through to the Rust-side timeout.
      // Reaching the assertion below at all proves construction didn't throw.
      const component = createComponent({
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
      });

      expect(component["requesterDisplayName"]).toBe("agentAccessUnknownApplication");
      expect(mockI18nService.t).toHaveBeenCalledWith("agentAccessUnknownApplication");
    });
  });

  // M4 (agent-access-architecture.md): matches are a discriminated union of credential/secret
  // kinds — these cover the secret side rendering the same picker/validation/approve/deny logic.
  describe("Secrets Manager secret matches", () => {
    it("preselects a single secret match, keyed by secretId", () => {
      const match = makeSecretMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [match],
      });

      expect(component["hasMultipleMatches"]).toBe(false);
      expect(component["approveCredentialRequestForm"].valid).toBe(true);
      expect(component["selectedMatch"]()).toEqual(match);
    });

    it("approves the selected secretId on submit", async () => {
      const match = makeSecretMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [match],
      });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "s1" });
    });

    it("requires a selection among multiple secret matches and tracks the highlighted one", () => {
      const matches = [
        makeSecretMatch({ secretId: "s1", secretName: "DB_PASSWORD", organizationName: "Acme" }),
        makeSecretMatch({ secretId: "s2", secretName: "DB_PASSWORD", organizationName: "Other" }),
      ];
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "db_password",
        matches,
      });

      expect(component["hasMultipleMatches"]).toBe(true);
      expect(component["approveCredentialRequestForm"].valid).toBe(false);

      component["approveCredentialRequestForm"].patchValue({ selectedId: "s2" });

      expect(component["selectedMatch"]()).toEqual(matches[1]);
    });

    it("denies a secret request the same way as a credential request", async () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [makeSecretMatch()],
      });

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });
});
