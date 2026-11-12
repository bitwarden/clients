import { Router } from "@koa/router";

import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  parseOrganizationIdOption,
  pamErrorResponse,
  registerPamServeRoute,
  requireYes,
  PamServeRequest,
} from "../shared";

import { RuleOperations } from "./rule-operations";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bodyObject(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/**
 * Registers the `bw serve` routes of the rules group, under `/pam`. The organization is the
 * `organizationid` query parameter. `GET` reads and `POST` writes; `create` and `update` take the
 * rule JSON as the body. `disable` and `delete` need `{"yes": true}` in the body, as the commands
 * need `--yes`, and so does an `update` that weakens governance. Nothing here returns a secret.
 *
 * - `GET /pam/rule`, `GET /pam/rule/:ruleId`, `GET /pam/rule/:ruleId/bypassable`
 * - `POST /pam/rule`, `POST /pam/rule/:ruleId`, `POST /pam/rule/:ruleId/enable`,
 *   `POST /pam/rule/:ruleId/disable`, `POST /pam/rule/:ruleId/delete`
 */
export function registerServeRoutes(router: Router, container: ServiceContainer): void {
  const operations = new RuleOperations(container);

  const organizationOf = (request: PamServeRequest): string =>
    parseOrganizationIdOption(first(request.query.organizationid));

  /** The write pre-check, as the commands run it. A write also needs `canManageAccessRules`. */
  const write =
    (run: (request: PamServeRequest, organizationId: string) => Promise<Response>) =>
    async (request: PamServeRequest): Promise<Response> => {
      try {
        const organizationId = organizationOf(request);
        const refusal = await operations.refuseIfCannotWrite(request.userId, organizationId);
        return refusal != null ? Response.error(refusal) : await run(request, organizationId);
      } catch (e) {
        return pamErrorResponse(e);
      }
    };

  /** The read pre-check: the organization must use Privileged Controls. */
  const read =
    (run: (request: PamServeRequest, organizationId: string) => Promise<Response>) =>
    async (request: PamServeRequest): Promise<Response> => {
      try {
        const organizationId = organizationOf(request);
        const refusal = await operations.refuseIfCannotRead(request.userId, organizationId);
        return refusal != null ? Response.error(refusal) : await run(request, organizationId);
      } catch (e) {
        return pamErrorResponse(e);
      }
    };

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/rule",
    handler: read((r, org) => operations.list(r.userId, org, false)),
  });
  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/rule/:ruleId",
    handler: read((r, org) => operations.get(r.userId, org, r.params.ruleId, false)),
  });
  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/rule/:ruleId/bypassable",
    handler: read((r, org) => operations.bypassable(r.userId, org, r.params.ruleId, false)),
  });
  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/rule",
    handler: write((r, org) => operations.create(r.userId, org, r.body)),
  });
  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/rule/:ruleId",
    handler: write(async (r, org) => {
      // `yes` rides in the rule body, but is not a field of a rule, which the parser would refuse.
      const { yes, ...rule } = bodyObject(r.body);
      const result = await operations.update(
        r.userId,
        org,
        r.params.ruleId,
        typeof r.body === "object" && r.body !== null && !Array.isArray(r.body) ? rule : r.body,
        yes === true,
      );
      return result.response;
    }),
  });
  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/rule/:ruleId/enable",
    handler: write((r, org) => operations.enable(r.userId, org, r.params.ruleId)),
  });
  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/rule/:ruleId/disable",
    handler: write(async (r, org) => {
      const refusal = requireYes(
        { yes: bodyObject(r.body).yes === true },
        "disable this rule, which makes its collections reachable without a lease",
      );
      return refusal ?? (await operations.disable(r.userId, org, r.params.ruleId)).response;
    }),
  });
  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/rule/:ruleId/delete",
    handler: write(async (r, org) => {
      const refusal = requireYes(
        { yes: bodyObject(r.body).yes === true },
        "permanently delete this rule, which makes its collections reachable without a lease",
      );
      return refusal ?? (await operations.delete(r.userId, org, r.params.ruleId)).response;
    }),
  });
}
