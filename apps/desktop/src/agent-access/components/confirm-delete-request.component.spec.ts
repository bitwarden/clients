import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  ConfirmDeleteRequestComponent,
  ConfirmDeleteRequestParams,
  ConfirmDeleteRequestResult,
} from "./confirm-delete-request.component";

function makeParams(
  overrides: Partial<ConfirmDeleteRequestParams> = {},
): ConfirmDeleteRequestParams {
  return {
    kind: "secret",
    itemName: "DB_PASSWORD",
    ...overrides,
  };
}

describe("ConfirmDeleteRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ConfirmDeleteRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<ConfirmDeleteRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: ConfirmDeleteRequestParams): ConfirmDeleteRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ConfirmDeleteRequestComponent());
  }

  describe("isProject", () => {
    it("is false for a secret delete", () => {
      const component = createComponent(makeParams({ kind: "secret" }));
      expect(component["isProject"]()).toBe(false);
    });

    it("is true for a project delete", () => {
      const component = createComponent(makeParams({ kind: "project" }));
      expect(component["isProject"]()).toBe(true);
    });
  });

  describe("submit", () => {
    it("closes with approved: true", async () => {
      const component = createComponent(makeParams());

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true });
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
    it("falls back to the unknown-application label when no name or fingerprint is present", () => {
      const component = createComponent(makeParams());
      expect(component["requesterDisplayName"]).toBe("agentAccessUnknownApplication");
    });

    it("prefers the requester name", () => {
      const component = createComponent(makeParams({ requesterName: "Cursor" }));
      expect(component["requesterDisplayName"]).toBe("Cursor");
    });
  });

  describe("params passthrough", () => {
    it("exposes the resolved item name and contained secret count, display-only", () => {
      const component = createComponent(
        makeParams({ kind: "project", itemName: "my-app", containedSecretCount: 3 }),
      );

      expect(component.params.itemName).toBe("my-app");
      expect(component.params.containedSecretCount).toBe(3);
    });
  });
});
