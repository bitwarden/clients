import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  ProjectListRequestComponent,
  ProjectListRequestParams,
  ProjectListRequestResult,
} from "./project-list-request.component";

function makeParams(overrides: Partial<ProjectListRequestParams> = {}): ProjectListRequestParams {
  return {
    entries: [{ name: "my-app", organizationName: "Acme Inc", write: true }],
    ...overrides,
  };
}

describe("ProjectListRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ProjectListRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<ProjectListRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: ProjectListRequestParams): ProjectListRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ProjectListRequestComponent());
  }

  it("exposes every entry that will be released, display-only", () => {
    const component = createComponent(
      makeParams({
        entries: [
          { name: "my-app", organizationName: "Acme Inc", write: true },
          { name: "other-app", organizationName: "Acme Inc", write: false },
        ],
      }),
    );

    expect(component.params.entries).toHaveLength(2);
    expect(component.params.entries.map((e) => e.name)).toEqual(["my-app", "other-app"]);
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
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent(makeParams({ requesterFingerprint: "abcdef123456" }));

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });
  });
});
