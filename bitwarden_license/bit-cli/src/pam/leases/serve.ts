import { Router } from "@koa/router";
import { firstValueFrom } from "rxjs";

import { LeasesService } from "@bitwarden/bit-common/pam/leases";
import { parseDuration, PamInputError } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import {
  checkAnyOrganizationRequirement,
  createPamSdkService,
  PamOrganizationRequirement,
  registerPamServeRoute,
} from "../shared";

import { LeaseChangeResponse, LeaseResponse } from "./lease.response";

type LeaseBody = { duration?: unknown; reason?: unknown; yes?: unknown };

const asBody = (body: unknown): LeaseBody =>
  body != null && typeof body === "object" ? (body as LeaseBody) : {};

/**
 * Registers `GET /pam/lease`, `POST /pam/lease/:leaseId/extend` and `POST /pam/lease/:leaseId/end`.
 * `lease reveal` has no route: it returns a secret, and the serve policy forbids that. The reason
 * travels in the JSON body, never the URL, and `end` needs `"yes": true` in it.
 */
export function registerServeRoutes(router: Router, container: ServiceContainer): void {
  const leases = new LeasesService(createPamSdkService(container));

  const requireOrganization = async (
    userId: Parameters<typeof container.organizationService.organizations$>[0],
    requirement: PamOrganizationRequirement,
  ): Promise<Response | undefined> => {
    const organizations = await firstValueFrom(
      container.organizationService.organizations$(userId),
    );
    const refusal = checkAnyOrganizationRequirement(organizations, requirement);
    return refusal == null ? undefined : Response.error(refusal);
  };

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/lease",
    handler: async ({ userId, query }) => {
      const refusal = await requireOrganization(userId, PamOrganizationRequirement.UsePam);
      if (refusal != null) {
        return refusal;
      }
      const rows = await leases.list(userId, query.active === "true");
      return Response.success(new ListResponse(rows.map((l) => new LeaseResponse(l))));
    },
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/lease/:leaseId/extend",
    handler: async ({ userId, params, body }) => {
      const refusal = await requireOrganization(userId, PamOrganizationRequirement.AccessPam);
      if (refusal != null) {
        return refusal;
      }
      const { duration, reason } = asBody(body);
      if (typeof duration !== "string" && typeof duration !== "number") {
        throw new PamInputError("`duration` is required in the body.");
      }
      if (typeof reason !== "string") {
        throw new PamInputError("`reason` is required in the body.");
      }
      const seconds = parseDuration(String(duration), "duration");
      const result = await leases.extend(userId, params.leaseId, seconds, reason);
      return Response.success(new LeaseChangeResponse(result.leaseId, result.status, result));
    },
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/lease/:leaseId/end",
    handler: async ({ userId, params, body }) => {
      const refusal = await requireOrganization(userId, PamOrganizationRequirement.UsePam);
      if (refusal != null) {
        return refusal;
      }
      const { reason, yes } = asBody(body);
      if (yes !== true) {
        return Response.badRequest(
          'This would end this lease. Send `"yes": true` in the body to confirm.',
        );
      }
      const id = await leases.end(
        userId,
        params.leaseId,
        typeof reason === "string" ? reason : undefined,
      );
      return Response.success(new LeaseChangeResponse(id, "ended"));
    },
  });
}
