import { Router } from "@koa/router";
import { firstValueFrom } from "rxjs";

import { RotationService } from "@bitwarden/bit-common/pam/rotation";
import { PamInputError, parseGuid } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UserId } from "@bitwarden/common/types/guid";

import { ServiceContainer } from "../../service-container";
import {
  checkOrganizationRequirement,
  createPamSdkService,
  PamOrganizationRequirement,
  registerPamServeRoute,
} from "../shared";

import { RotationConfigResponse, RotationScheduleResponse } from "./rotation.response";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Registers the read-only `bw serve` routes of the rotation group: `GET /pam/rotation`
 * (`?organizationid=`), `GET /pam/rotation/:configId` and `GET /pam/rotation/schedule/:value`.
 * Mutations stay commander-only, because they carry the account identity and the destructive
 * ones need `--yes`. `list` and `get` make the same ManageRotation pre-check as the commands; the server stays the authority.
 */
export function registerServeRoutes(router: Router, container: ServiceContainer): void {
  const flags = [FeatureFlag.PamAccessConnector];
  const service = () => new RotationService(createPamSdkService(container));

  /** The same ManageRotation pre-check the commands make. The server stays the authority. */
  const checkRights = async (userId: UserId, organizationId: string): Promise<void> => {
    const organizations = await firstValueFrom(
      container.organizationService.organizations$(userId),
    );
    const refusal = checkOrganizationRequirement(
      organizations.find((o) => o.id === organizationId),
      PamOrganizationRequirement.ManageRotation,
    );
    if (refusal != null) {
      throw new PamInputError(refusal);
    }
  };

  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/rotation/schedule/:value",
    flags,
    handler: async ({ userId, params }) =>
      Response.success(
        new RotationScheduleResponse(await service().resolveSchedule(userId, params.value)),
      ),
  });
  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/rotation",
    flags,
    handler: async ({ userId, query }) => {
      const organizationId = parseGuid(first(query.organizationid), "organization id");
      await checkRights(userId, organizationId);
      const items = await service().list(userId, organizationId);
      return Response.success(new ListResponse(items.map((i) => new RotationConfigResponse(i))));
    },
  });
  registerPamServeRoute(router, container, {
    method: "GET",
    path: "/rotation/:configId",
    flags,
    handler: async ({ userId, params, query }) => {
      const organizationId = parseGuid(first(query.organizationid), "organization id");
      await checkRights(userId, organizationId);
      const detail = await service().get(
        userId,
        organizationId,
        parseGuid(params.configId, "config id"),
        5,
      );
      return Response.success(RotationConfigResponse.detail(detail));
    },
  });
}
