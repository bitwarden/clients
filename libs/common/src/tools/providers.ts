import { PolicyService } from "../admin-console/abstractions/policy/policy.service.abstraction";

import { ExtensionService } from "./extension/extension.service";
import { LogProvider } from "./log";

/** Provides access to commonly-used cross-cutting services. */
export type SystemServiceProvider = {
  /** Policy configured by the administrative console */
  readonly policy: PolicyService;

  /** Client extension metadata and profile access */
  readonly extension: ExtensionService;

  /** Event monitoring and diagnostic interfaces */
  readonly log: LogProvider;
};
