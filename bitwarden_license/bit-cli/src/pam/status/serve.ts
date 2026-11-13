import { Router } from "@koa/router";

import { ServiceContainer } from "../../service-container";

/**
 * Registers the `bw serve` routes of the status group, under the policy in `../shared/serve-route.ts`.
 * It registers nothing: `status` must work with the Pam flag off, which serve routes require.
 */
export function registerServeRoutes(_router: Router, _container: ServiceContainer): void {
  // Intentionally empty. See README.md.
}
