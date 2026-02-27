import { PasswordStrengthService } from "./password-strength.service";

describe("PasswordStrengthService", () => {
  test.each([
    ["password", "random@bitwarden.com", 0],
    ["password11", "random@bitwarden.com", 1],
    ["Weakpass2", "random@bitwarden.com", 2],
    ["GoodPass3!", "random@bitwarden.com", 3],
    ["VeryStrong123@#", "random@bitwarden.com", 4],
  ])("getPasswordStrength(%s, %s) should return %i", (password, email, expected) => {
    const service = new PasswordStrengthService();

    const result = service.getPasswordStrength(password, email);

    expect(result.score).toBe(expected);
  });

  it("getPasswordStrength should penalize passwords that contain the email address", () => {
    const service = new PasswordStrengthService();

    const resultWithoutEmail = service.getPasswordStrength("asdfjkhkjwer!", "random@bitwarden.com");
    expect(resultWithoutEmail.score).toBe(4);

    const result = service.getPasswordStrength("asdfjkhkjwer!", "asdfjkhkjwer@bitwarden.com");
    expect(result.score).toBe(1);
  });
});
