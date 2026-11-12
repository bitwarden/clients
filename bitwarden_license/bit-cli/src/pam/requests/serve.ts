import { Router } from "@koa/router";
import { firstValueFrom } from "rxjs";

import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { UserId } from "@bitwarden/common/types/guid";

import { ServiceContainer } from "../../service-container";
import {
  checkAnyOrganizationRequirement,
  MAX_PAM_TEXT_LENGTH,
  PamOrganizationRequirement,
  PamServeRequest,
  registerPamServeRoute,
} from "../shared";

import { createRequestOperations, RequestOperations } from "./request.operations";

function queryValue(request: PamServeRequest, key: string): string | undefined {
  const value = request.query[key];
  return Array.isArray(value) ? value[0] : value;
}

function bodyText(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (key === "duration" && typeof value === "number") {
    return String(value);
  }
  throw new PamInputError(`\`${key}\` must be text.`);
}

function bodyObject(body: unknown): Record<string, unknown> {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new PamInputError("A JSON object body is required.");
  }
  return body as Record<string, unknown>;
}

/** The serve twin of the commander guard: `registerPamServeRoute` checks flags and the vault only. */
async function refusal(
  container: ServiceContainer,
  userId: UserId,
  requirement: PamOrganizationRequirement,
): Promise<Response | undefined> {
  const organizations = await firstValueFrom(container.organizationService.organizations$(userId));
  const message = checkAnyOrganizationRequirement(organizations, requirement);
  return message == null ? undefined : Response.error(message);
}

/**
 * `bw serve` routes of the requests group, under `/pam`: `GET /request/status/:cipherId`,
 * `GET /request`, `GET /request/:requestId`, `POST /request/create`,
 * `POST /request/:requestId/activate` and `POST /request/:requestId/cancel`.
 *
 * A reason travels in the `POST` body, never in the URL. No route returns a credential.
 */
export function registerServeRoutes(
  router: Router,
  container: ServiceContainer,
  operations: RequestOperations = createRequestOperations(container),
): void {
  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/request/status/:cipherId",
    handler: async (req) =>
      (await refusal(container, req.userId, PamOrganizationRequirement.UsePam)) ??
      (await operations.status(req.userId, req.params.cipherId, {
        precheck: queryValue(req, "precheck") === "true",
      })),
  });

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/request",
    handler: async (req) =>
      (await refusal(container, req.userId, PamOrganizationRequirement.UsePam)) ??
      (await operations.list(req.userId, { status: queryValue(req, "status") })),
  });

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/request/:requestId",
    handler: async (req) =>
      (await refusal(container, req.userId, PamOrganizationRequirement.UsePam)) ??
      (await operations.get(req.userId, req.params.requestId, {})),
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/request/create",
    handler: async (req) => {
      const body = bodyObject(req.body);
      const reason = bodyText(body, "reason")?.trim();
      if (reason != null && reason.length > MAX_PAM_TEXT_LENGTH) {
        throw new PamInputError(`The reason is longer than ${MAX_PAM_TEXT_LENGTH} characters.`);
      }
      const cipherId = bodyText(body, "cipherId");
      return (
        (await refusal(container, req.userId, PamOrganizationRequirement.AccessPam)) ??
        (await operations.create(req.userId, {
          cipherId: cipherId ?? "",
          duration: bodyText(body, "duration"),
          start: bodyText(body, "start"),
          end: bodyText(body, "end"),
          reason: reason === "" ? undefined : reason,
        }))
      );
    },
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/request/:requestId/activate",
    handler: async (req) =>
      (await refusal(container, req.userId, PamOrganizationRequirement.AccessPam)) ??
      (await operations.activate(req.userId, req.params.requestId)),
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/request/:requestId/cancel",
    handler: async (req) =>
      (await refusal(container, req.userId, PamOrganizationRequirement.UsePam)) ??
      (await operations.cancel(req.userId, req.params.requestId)),
  });
}
