import { Router } from "@koa/router";

import { ApprovalsService } from "@bitwarden/bit-common/pam/approvals";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import {
  createPamNameResolver,
  createPamSdkService,
  parseIdOption,
  PamServeRequest,
  registerPamServeRoute,
} from "../shared";

import { decideRequest, revokeLease, withdrawRequest } from "./approval-actions";
import { ApprovalRowResponse, ManagedLeaseResponse } from "./approval.response";
import { refuseNonApprover } from "./approver-guard";

function bodyOf(request: PamServeRequest): Record<string, unknown> {
  return typeof request.body === "object" && request.body != null
    ? (request.body as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function wantsNames(request: PamServeRequest): boolean {
  return request.query["names"] === "true";
}

/**
 * Registers the approvals routes under `/pam/approval`. Comments and reasons travel in a body,
 * never in a URL. The destructive routes need `"yes": true` in the body, as the commands need
 * `--yes`. Every route refuses a non-approver first, as the commands do, with no SDK call.
 */
export function registerServeRoutes(router: Router, container: ServiceContainer): void {
  const service = () => new ApprovalsService(createPamSdkService(container));
  const names = async (request: PamServeRequest) =>
    wantsNames(request) ? await createPamNameResolver(container).load() : undefined;
  const confirmed = (request: PamServeRequest, action: string): Response | undefined =>
    bodyOf(request)["yes"] === true
      ? undefined
      : Response.badRequest(`This would ${action}. Send "yes": true in the body to confirm.`);

  const approverOnly =
    (handler: (request: PamServeRequest) => Promise<Response>) =>
    async (request: PamServeRequest): Promise<Response> =>
      (await refuseNonApprover(container, request.userId)) ?? (await handler(request));

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/approval/inbox",
    handler: approverOnly(async (request) => {
      const rows = await service().inbox(request.userId);
      const lookup = await names(request);
      return Response.success(
        new ListResponse(rows.map((row) => new ApprovalRowResponse(row, lookup))),
      );
    }),
  });

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/approval/history",
    handler: approverOnly(async (request) => {
      const rows = await service().history(request.userId);
      const lookup = await names(request);
      return Response.success(
        new ListResponse(rows.map((row) => new ApprovalRowResponse(row, lookup))),
      );
    }),
  });

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/approval/managed-leases",
    handler: approverOnly(async (request) => {
      const rows = await service().managedLeases(request.userId, request.query["all"] === "true");
      const lookup = await names(request);
      return Response.success(
        new ListResponse(rows.map((row) => new ManagedLeaseResponse(row, lookup))),
      );
    }),
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/approval/:requestId/decide",
    handler: approverOnly(async (request) => {
      const body = bodyOf(request);
      const verdict = body["verdict"];
      if (verdict !== "approve" && verdict !== "deny") {
        return Response.badRequest('The verdict must be "approve" or "deny".');
      }
      const id = parseIdOption(request.params["requestId"], "request id");
      return await decideRequest(service(), request.userId, id, verdict, text(body["comment"]));
    }),
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/approval/:requestId/withdraw",
    handler: approverOnly(async (request) => {
      const id = parseIdOption(request.params["requestId"], "request id");
      return (
        confirmed(request, "withdraw this approval") ??
        (await withdrawRequest(service(), request.userId, id))
      );
    }),
  });

  registerPamServeRoute(router, container, {
    method: "POST",
    path: "/approval/lease/:leaseId/revoke",
    handler: approverOnly(async (request) => {
      const id = parseIdOption(request.params["leaseId"], "lease id");
      return (
        confirmed(request, "end this lease now") ??
        (await revokeLease(service(), request.userId, id, text(bodyOf(request)["reason"])))
      );
    }),
  });
}
