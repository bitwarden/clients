const _PageScenario = Object.freeze({
  LoginPage: "loginPage",
  RegistrationPage: "registrationPage",
  PasswordChangePage: "passwordChangePage",
  CheckoutPage: "checkoutPage",
  ProfilePage: "profilePage",
} as const);

type _PageScenario = typeof _PageScenario;

export type PageScenario = _PageScenario[keyof _PageScenario];

// FIXME: Update typing of `PageScenario` to be `Record<keyof _PageScenario, PageScenario>` which is ADR-0025 compliant when the TypeScript version is at least 5.8.
export const PageScenario: typeof _PageScenario = _PageScenario;
