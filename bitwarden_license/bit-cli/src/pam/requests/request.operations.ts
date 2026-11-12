import {
  AccessRequestsService,
  listAccessRequestRows,
  parseCreateShape,
  parseStatusFilter,
  planCreateRequest,
} from "@bitwarden/bit-common/pam/requests";
import {
  PamNames,
  parseGuid,
  PamNameResolver,
  PamSdkService,
} from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { UserId } from "@bitwarden/common/types/guid";

import { ServiceContainer } from "../../service-container";
import { createPamNameResolver, createPamSdkService } from "../shared";

import {
  AccessRequestActivatedResponse,
  AccessRequestCreatedResponse,
  AccessRequestResponse,
  CipherAccessStateResponse,
} from "./request.response";

export interface CreateRequestArguments {
  cipherId: string;
  duration?: string;
  start?: string;
  end?: string;
  /** Already read and trimmed. Never logged or echoed. */
  reason?: string;
}

const SLOT_BUSY_WARNING =
  "Another member currently holds this item's single active lease. The request was still created; activation may be refused until that lease ends.";

/**
 * What each `bw privileged-controls request` verb does, shared by the commander commands and the `bw serve`
 * routes so both behave alike. Every method returns a `Response`; a thrown error is turned into
 * a failed response by the caller.
 */
export class RequestOperations {
  constructor(
    private requests: AccessRequestsService,
    private loadNames: () => Promise<PamNames>,
    private now: () => Date = () => new Date(),
  ) {}

  async status(
    userId: UserId,
    cipherIdText: string,
    options: { precheck?: boolean; names?: boolean },
  ): Promise<Response> {
    const cipherId = parseGuid(cipherIdText, "cipher id");
    const state = await this.requests.cipherAccessState(userId, cipherId);
    const preCheck = options.precheck ? await this.requests.preCheck(userId, cipherId) : undefined;
    const names = options.names ? await this.loadNames() : undefined;
    return Response.success(
      new CipherAccessStateResponse(state, { preCheck, names, nowMs: this.now().getTime() }),
    );
  }

  async create(userId: UserId, args: CreateRequestArguments): Promise<Response> {
    const cipherId = parseGuid(args.cipherId, "cipher id");
    // The flags are checked before anything is sent, so a bad shape never costs a round trip.
    const shape = parseCreateShape(args);
    const preCheck = await this.requests.preCheck(userId, cipherId);
    const plan = planCreateRequest(shape, args.reason, preCheck, this.now());
    const result = await this.requests.request(userId, cipherId, plan.request);
    return Response.success(
      new AccessRequestCreatedResponse(
        result.request,
        plan.approvalMode,
        plan.slotBusy ? SLOT_BUSY_WARNING : undefined,
      ),
    );
  }

  async list(userId: UserId, options: { status?: string; names?: boolean }): Promise<Response> {
    const status = parseStatusFilter(options.status);
    const views = await this.requests.listMine(userId);
    const names = options.names ? await this.loadNames() : undefined;
    const rows = listAccessRequestRows(views, status);
    return Response.success(
      new ListResponse(rows.map((row) => new AccessRequestResponse(row.request, names, row))),
    );
  }

  async get(
    userId: UserId,
    requestIdText: string,
    options: { names?: boolean },
  ): Promise<Response> {
    const requestId = parseGuid(requestIdText, "request id");
    const view = await this.requests.get(userId, requestId);
    const names = options.names ? await this.loadNames() : undefined;
    return Response.success(new AccessRequestResponse(view, names));
  }

  async activate(userId: UserId, requestIdText: string): Promise<Response> {
    const requestId = parseGuid(requestIdText, "request id");
    const lease = await this.requests.activate(userId, requestId);
    return Response.success(new AccessRequestActivatedResponse(lease));
  }

  async cancel(userId: UserId, requestIdText: string): Promise<Response> {
    const requestId = parseGuid(requestIdText, "request id");
    await this.requests.cancel(userId, requestId);
    return Response.success(new MessageResponse(`Request ${requestId} canceled.`, null));
  }
}

export function createRequestOperations(container: ServiceContainer): RequestOperations {
  const sdk: PamSdkService = createPamSdkService(container);
  const resolver: PamNameResolver = createPamNameResolver(container);
  return new RequestOperations(new AccessRequestsService(sdk), () => resolver.load());
}
