import { Router } from "@koa/router";
import { firstValueFrom } from "rxjs";

import { ConnectorService } from "@bitwarden/bit-common/pam/connectors";
import { parseGuid } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../../service-container";
import {
  checkOrganizationRequirement,
  createPamSdkService,
  PamOrganizationRequirement,
  PamServeRequest,
  registerPamServeRoute,
} from "../shared";

import {
  ConnectorActionResponse,
  ConnectorDetailResponse,
  ConnectorResponse,
} from "./connector.response";

const FLAGS = [FeatureFlag.PamAccessConnector] as const;

/**
 * Routes under `/pam/connector`. The organization is the `organizationid` query parameter.
 * There is no `register` route, because its result is a one-time token, and no `delete` route,
 * because it is permanent: both stay on the command line.
 */
export function registerServeRoutes(router: Router, container: ServiceContainer): void {
  const service = new ConnectorService(createPamSdkService(container));

  const organizationOf = (request: PamServeRequest): string => {
    const value = request.query["organizationid"];
    return parseGuid(Array.isArray(value) ? value[0] : value, "organization id");
  };

  /** The same cheap pre-check as the commands. Returns the refusal, or the organization id. */
  const authorize = async (
    request: PamServeRequest,
    requirement: PamOrganizationRequirement,
  ): Promise<{ organizationId: string } | Response> => {
    const organizationId = organizationOf(request);
    const organizations = await firstValueFrom(
      container.organizationService.organizations$(request.userId),
    );
    const refusal = checkOrganizationRequirement(
      organizations.find((o) => o.id === organizationId),
      requirement,
    );
    return refusal == null ? { organizationId } : Response.error(refusal);
  };

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/connector",
    flags: FLAGS,
    handler: async (request) => {
      const auth = await authorize(request, PamOrganizationRequirement.UsePam);
      if (auth instanceof Response) {
        return auth;
      }
      const views = await service.list(request.userId, auth.organizationId);
      return Response.success(new ListResponse(views.map((v) => new ConnectorResponse(v))));
    },
  });

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/connector/:id",
    flags: FLAGS,
    handler: async (request) => {
      const auth = await authorize(request, PamOrganizationRequirement.UsePam);
      if (auth instanceof Response) {
        return auth;
      }
      const view = await service.get(request.userId, auth.organizationId, request.params.id);
      return Response.success(new ConnectorDetailResponse(view));
    },
  });

  const post = (
    path: string,
    action: ConnectorActionResponse["action"],
    run: (request: PamServeRequest, organizationId: string) => Promise<void>,
  ) =>
    registerPamServeRoute(router, container, {
      method: "POST",
      path,
      flags: FLAGS,
      handler: async (request) => {
        const auth = await authorize(request, PamOrganizationRequirement.ManageRotation);
        if (auth instanceof Response) {
          return auth;
        }
        await run(request, auth.organizationId);
        return Response.success(
          new ConnectorActionResponse(
            action,
            parseGuid(request.params.id, "connector id"),
            auth.organizationId,
            request.params.targetSystemId == null
              ? undefined
              : parseGuid(request.params.targetSystemId, "target system id"),
          ),
        );
      },
    });

  post("/connector/:id/enable", "enabled", (r, org) => service.enable(r.userId, org, r.params.id));
  post("/connector/:id/disable", "disabled", (r, org) =>
    service.disable(r.userId, org, r.params.id),
  );
  post("/connector/:id/assign/:targetSystemId", "assigned", (r, org) =>
    service.assign(r.userId, org, r.params.id, r.params.targetSystemId),
  );
  post("/connector/:id/unassign/:targetSystemId", "unassigned", (r, org) =>
    service.unassign(r.userId, org, r.params.id, r.params.targetSystemId),
  );
}
