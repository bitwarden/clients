import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";

import { ProblemDetailsErrorResponse } from "@bitwarden/common/models/response/problem-details-error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ProblemDetailsService } from "./problem-details.service";

function makeEmailError(type: string) {
  return new ProblemDetailsErrorResponse(
    { errors: { email: [{ type, detail: "server detail" }] } },
    400,
  );
}

const EMAIL_FIELD_MAP = {
  email: {
    new_email_domain_not_claimed: "emailErrorNotClaimedDomain",
    email_already_in_use: "emailErrorAlreadyInUse",
  },
};

describe("ProblemDetailsService", () => {
  let service: ProblemDetailsService;
  let i18nService: jest.Mocked<I18nService>;
  let fb: FormBuilder;

  beforeEach(() => {
    i18nService = { t: jest.fn((key: string) => key) } as any;

    TestBed.configureTestingModule({
      providers: [ProblemDetailsService, { provide: I18nService, useValue: i18nService }],
    });

    service = TestBed.inject(ProblemDetailsService);
    fb = new FormBuilder();
  });

  it("returns true and sets serverError on email control for known error type", () => {
    const formGroup = fb.group({ email: [""] });
    const error = makeEmailError("new_email_domain_not_claimed");

    expect(service.applyErrors(error, formGroup, EMAIL_FIELD_MAP)).toBe(true);
    expect(formGroup.controls.email.errors?.serverError?.message).toBeDefined();
  });

  it("returns false for unknown problem-detail type", () => {
    const formGroup = fb.group({ email: [""] });
    const error = makeEmailError("unknown_error_type");

    expect(service.applyErrors(error, formGroup, EMAIL_FIELD_MAP)).toBe(false);
    expect(formGroup.controls.email.errors).toBeNull();
  });

  it("returns false for non-ErrorResponse errors", () => {
    const formGroup = fb.group({ email: [""] });
    const error = new Error("generic");

    expect(service.applyErrors(error, formGroup, EMAIL_FIELD_MAP)).toBe(false);
  });

  it("returns false when field in rawErrors has no matching form control", () => {
    const formGroup = fb.group({ email: [""] });
    const err = new ProblemDetailsErrorResponse(
      { errors: { unknownField: [{ type: "new_email_domain_not_claimed", detail: "" }] } },
      400,
    );

    expect(service.applyErrors(err, formGroup, EMAIL_FIELD_MAP)).toBe(false);
  });
});
