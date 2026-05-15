export const PageScenario = Object.freeze({
  LoginPage: "loginPage",
  RegistrationPage: "registrationPage",
  PasswordChangePage: "passwordChangePage",
  CheckoutPage: "checkoutPage",
  ProfilePage: "profilePage",
} as const);
export type PageScenario = (typeof PageScenario)[keyof typeof PageScenario];
