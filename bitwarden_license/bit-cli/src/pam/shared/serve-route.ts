import { Router } from "@koa/router";
import * as koa from "koa";
import { firstValueFrom } from "rxjs";

import { Response } from "@bitwarden/cli/models/response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UserId } from "@bitwarden/common/types/guid";

import { ServiceContainer } from "../../service-container";

import { pamErrorResponse } from "./pam-response";

/**
 * The `bw serve` policy for PAM routes:
 *
 * - They run on whatever host `bw serve` binds, which is localhost unless the operator opts out,
 *   and `serve` already refuses a foreign `Host` or any `Origin`. Nothing here widens that.
 * - `GET` reads, `POST` mutates. Nothing else.
 * - No route returns a secret or writes a file. `lease reveal` and `connector register` have no
 *   route, and neither does any verb that saves to disk. They stay commander-only.
 * - Reasons and comments never travel in a URL or a query string; a body carries them.
 */
export type PamServeMethod = "GET" | "POST";

export interface PamServeRequest {
  userId: UserId;
  params: Readonly<Record<string, string>>;
  query: Readonly<Record<string, string | string[] | undefined>>;
  /** The parsed JSON body of a `POST`, else `undefined`. */
  body: unknown;
}

export interface PamServeRoute {
  method: PamServeMethod;
  /** Relative to `/pam`, for example `/lease/:leaseId/extend`. */
  path: string;
  /** Flags required beyond `FeatureFlag.Pam`, which every route checks. */
  flags?: readonly FeatureFlag[];
  handler: (request: PamServeRequest) => Promise<Response>;
}

/** The prefix of every PAM route. */
export const PAM_SERVE_PREFIX = "/pam";

/**
 * Registers one PAM route: it checks the feature flags, requires an unlocked vault, runs the
 * handler, and writes the result as the other `serve` routes do, with status 400 for a failure.
 * Errors the handler throws become failed responses through `pamErrorResponse`.
 */
export function registerPamServeRoute(
  router: Router,
  container: ServiceContainer,
  route: PamServeRoute,
): void {
  const handle = async (ctx: koa.ParameterizedContext, next: koa.Next): Promise<void> => {
    writePamServeResponse(ctx.response, await runRoute(container, route, ctx));
    await next();
  };
  const path = `${PAM_SERVE_PREFIX}${route.path}`;
  if (route.method === "GET") {
    router.get(path, handle);
  } else {
    router.post(path, handle);
  }
}

async function runRoute(
  container: ServiceContainer,
  route: PamServeRoute,
  ctx: koa.ParameterizedContext,
): Promise<Response> {
  try {
    for (const flag of [FeatureFlag.Pam, ...(route.flags ?? [])]) {
      if (!(await firstValueFrom(container.configService.getFeatureFlag$(flag)))) {
        return Response.error("This command is temporarily unavailable.");
      }
    }
    const userId = (await firstValueFrom(container.accountService.activeAccount$))?.id;
    if (userId == null) {
      return Response.error("You are not logged in.");
    }
    if (!(await container.keyService.hasUserKey(userId))) {
      return Response.error("Vault is locked.");
    }
    return await route.handler({
      userId,
      params: (ctx as { params?: Record<string, string> }).params ?? {},
      query: ctx.query,
      body: route.method === "POST" ? (ctx.request as { body?: unknown }).body : undefined,
    });
  } catch (e) {
    return pamErrorResponse(e);
  }
}

/** The same shape as the OSS routes: the response object as the body, status 400 on failure. */
export function writePamServeResponse(res: koa.Response, response: Response): void {
  if (!response.success) {
    res.status = 400;
  }
  res.body = response;
}
