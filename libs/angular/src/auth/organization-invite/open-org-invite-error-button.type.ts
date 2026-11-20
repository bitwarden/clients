import { AuthRoute } from "../constants";

/**
 * Primary button rendered below the body on an open-org-invite error surface. Each arm
 * bundles the discriminator with its paired i18n label key and navigation target so
 * consumers can render the button without re-deriving those mappings.
 *
 * `go-to-login` navigates to the auth-team-owned {@link AuthRoute.Login}; `go-to-vault`
 * navigates to the app root, which is not an auth route and stays as a literal.
 */
export type OpenOrgInviteErrorButton =
  | {
      kind: "go-to-login";
      labelI18nKey: "goToLogin";
      navigateTo: `/${typeof AuthRoute.Login}`;
    }
  | { kind: "go-to-vault"; labelI18nKey: "goToVault"; navigateTo: "/" };
