import { AbstractControl, ValidationErrors } from "@angular/forms";

import { domainNameValidator } from "./domain-name.validator";

describe("domainNameValidator", () => {
  let validatorFn: (control: AbstractControl) => ValidationErrors | null;
  const errorMessage = "Invalid domain name";

  beforeEach(() => {
    validatorFn = domainNameValidator(errorMessage);
  });

  const testCases = [
    { value: "e.com", expected: null },
    { value: "example.com", expected: null },
    { value: "sub.example.com", expected: null },
    { value: "sub.sub.example.com", expected: null },
    { value: "example.co.uk", expected: null },
    { value: "example", expected: { invalidDomainName: { message: errorMessage } } },
    { value: "-example.com", expected: { invalidDomainName: { message: errorMessage } } },
    { value: "example-.com", expected: { invalidDomainName: { message: errorMessage } } },
    { value: "example..com", expected: { invalidDomainName: { message: errorMessage } } },
    { value: "http://example.com", expected: { invalidDomainName: { message: errorMessage } } },
    { value: "www.example.com", expected: { invalidDomainName: { message: errorMessage } } },
    { value: "", expected: null },
    { value: "x".repeat(64) + ".com", expected: { invalidDomainName: { message: errorMessage } } },
  ];

  describe("run test cases", () => {
    testCases.forEach(({ value, expected }) => {
      test(`should return ${JSON.stringify(expected)} for value "${value}"`, () => {
        const control = { value } as AbstractControl;
        expect(validatorFn(control)).toEqual(expected);
      });
    });
  });
});
