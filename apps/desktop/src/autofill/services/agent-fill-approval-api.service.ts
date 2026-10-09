import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { AgentFillApprovalRecord } from "../models/agent-fill-approval-record";

export type AgentFillAnswerResult =
  | { kind: "answered"; record: AgentFillApprovalRecord }
  /** 409: another device answered first. The record holds that answer. */
  | { kind: "alreadyAnswered"; record: AgentFillApprovalRecord }
  /** 410 */
  | { kind: "expired" };

/** Calls the server's `/agent-fill/approvals` endpoints. Sends sealed strings only. */
@Injectable({ providedIn: "root" })
export class AgentFillApprovalApiService {
  private readonly apiService = inject(ApiService);

  async create(sealedRequest: string): Promise<AgentFillApprovalRecord> {
    const r = await this.apiService.send(
      "POST",
      "/agent-fill/approvals",
      { sealedRequest },
      true,
      true,
    );
    return new AgentFillApprovalRecord(r);
  }

  async get(id: string): Promise<AgentFillApprovalRecord> {
    const r = await this.apiService.send("GET", `/agent-fill/approvals/${id}`, null, true, true);
    return new AgentFillApprovalRecord(r);
  }

  async answer(id: string, sealedResponse: string): Promise<AgentFillAnswerResult> {
    try {
      const r = await this.apiService.send(
        "PUT",
        `/agent-fill/approvals/${id}`,
        { sealedResponse },
        true,
        true,
      );
      return { kind: "answered", record: new AgentFillApprovalRecord(r) };
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 409) {
        // ErrorResponse doesn't keep the body, so read the stored record.
        return { kind: "alreadyAnswered", record: await this.get(id) };
      }
      if (e instanceof ErrorResponse && e.statusCode === 410) {
        return { kind: "expired" };
      }
      throw e;
    }
  }
}
