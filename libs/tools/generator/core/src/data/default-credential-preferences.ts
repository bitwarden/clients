import { CredentialPreference } from "../types";

import { EmailAlgorithms, PasswordAlgorithms, UsernameAlgorithms } from "./generator-types";

export const DefaultCredentialPreferences: CredentialPreference = Object.freeze({
  email: Object.freeze({
    algorithm: EmailAlgorithms[0],
    updated: new Date(0),
  }),
  password: Object.freeze({
    algorithm: PasswordAlgorithms[0],
    updated: new Date(0),
  }),
  username: Object.freeze({
    algorithm: UsernameAlgorithms[0],
    updated: new Date(0),
  }),
});
