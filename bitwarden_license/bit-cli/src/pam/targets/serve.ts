import { Router } from "@koa/router";
import { firstValueFrom } from "rxjs";

import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import {
  TargetSystemService,
  targetSystemTemplate,
  validateTargetSystemRequest,
} from "@bitwarden/bit-common/pam/targets";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../../service-container";
import {
  checkOrganizationRequirement,
  createPamSdkService,
  PamOrganizationRequirement,
  parseIdOption,
  parseOrganizationIdOption,
  PamServeRequest,
  registerPamServeRoute,
} from "../shared";

import { parseTemplateMethod } from "./target-system-input";
import { TargetSystemResponse, TargetSystemTemplateResponse } from "./target-system.response";
import { targetSystemFailure } from "./targets.program";

const FLAGS = [FeatureFlag.PamAccessConnector];

/**
 * Registers the `bw serve` routes of `bw pam target`, under the policy in `../shared/serve-route.ts`.
 * `GET` reads and `POST` mutates, and the organization comes from `?organizationid=`. A request
 * body is the same JSON the commands take, and `delete` needs `{"yes": true}` in its body.
 */
export function registerServeRoutes(router: Router, container: ServiceContainer): void {
  const service = () => new TargetSystemService(createPamSdkService(container));

  /** Runs `act` after the same organization pre-check the commands make. */
  const route =
    (act: (request: PamServeRequest, organizationId: string) => Promise<Response>) =>
    async (request: PamServeRequest): Promise<Response> => {
      let organizationId: string | undefined;
      try {
        const raw = request.query["organizationid"];
        organizationId = parseOrganizationIdOption(Array.isArray(raw) ? raw[0] : raw);
        const organizations = await firstValueFrom(
          container.organizationService.organizations$(request.userId),
        );
        const refusal = checkOrganizationRequirement(
          organizations.find((o) => o.id === organizationId),
          PamOrganizationRequirement.ManageRotation,
        );
        if (refusal != null) {
          return Response.error(refusal);
        }
        return await act(request, organizationId);
      } catch (e) {
        return targetSystemFailure(e, organizationId);
      }
    };

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/target",
    flags: FLAGS,
    handler: route(async (request, organizationId) => {
      const targets = await service().list(request.userId, organizationId);
      return Response.success(new ListResponse(targets.map((t) => new TargetSystemResponse(t))));
    }),
  });

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/target/template",
    flags: FLAGS,
    handler: (request) => {
      try {
        const raw = request.query["method"];
        const method = parseTemplateMethod(Array.isArray(raw) ? raw[0] : raw);
        return Promise.resolve(
          Response.success(new TargetSystemTemplateResponse(targetSystemTemplate(method))),
        );
      } catch (e) {
        return Promise.resolve(targetSystemFailure(e, undefined));
      }
    },
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/target",
    flags: FLAGS,
    handler: route(async (request, organizationId) => {
      const created = await service().create(
        request.userId,
        organizationId,
        validateTargetSystemRequest(bodyObject(request.body)),
      );
      return Response.success(new TargetSystemResponse(created));
    }),
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/target/:id/update",
    flags: FLAGS,
    handler: route(async (request, organizationId) => {
      await service().update(
        request.userId,
        organizationId,
        parseIdOption(request.params["id"], "target system id"),
        bodyObject(request.body),
      );
      return Response.success(new MessageResponse("The target system was updated.", null));
    }),
  });

  for (const verb of ["enable", "disable"] as const) {
    registerPamServeRoute(router, container, {
      method: "POST",
      path: `/target/:id/${verb}`,
      flags: FLAGS,
      handler: route(async (request, organizationId) => {
        const id = parseIdOption(request.params["id"], "target system id");
        await service()[verb](request.userId, organizationId, id);
        return Response.success(new MessageResponse(`The target system was ${verb}d.`, null));
      }),
    });
  }

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/target/:id/delete",
    flags: FLAGS,
    handler: route(async (request, organizationId) => {
      const id = parseIdOption(request.params["id"], "target system id");
      if ((request.body as { yes?: unknown } | undefined)?.yes !== true) {
        return Response.badRequest(
          'This would permanently delete this target system. Send {"yes": true} in the body to confirm.',
        );
      }
      await service().delete(request.userId, organizationId, id);
      return Response.success(new MessageResponse("The target system was deleted.", null));
    }),
  });
}

function bodyObject(body: unknown): Record<string, unknown> {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new PamInputError("The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}
