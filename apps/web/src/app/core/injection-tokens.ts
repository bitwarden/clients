// Put web specific injection tokens here
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { Urls } from "@bitwarden/common/platform/abstractions/environment.service";

/**
 * Injection token for injecting the NodeJS process.env urls into services.
 * Using an injection token allows services to be tested without needing to
 * mock the process.env.
 */
export const ENV_URLS = new SafeInjectionToken<Urls>("ENV_URLS");
