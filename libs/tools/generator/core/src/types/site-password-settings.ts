import { PasswordGenerationOptions } from "./password-generation-options";

/** Password settings that follow a website's password rules. */
export type SitePasswordSettings = {
  /** The domain that the rules belong to */
  website: string;
  settings: PasswordGenerationOptions;
};
