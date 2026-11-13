import { Command } from "commander";

import { ApprovalsService } from "@bitwarden/bit-common/pam/approvals";
import { PamNames } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import {
  addNamesOption,
  addPamHelp,
  addYesOption,
  createPamNameResolver,
  createPamSdkService,
  PamBaseProgram,
  PamContext,
  parseIdOption,
  PamNamesOptions,
  PamYesOptions,
  requireYes,
} from "../shared";

import { decideRequest, revokeLease, withdrawRequest } from "./approval-actions";
import { ApprovalRowResponse, ManagedLeaseResponse } from "./approval.response";
import { refuseNonApprover } from "./approver-guard";

type CommentOptions = { comment?: string };
type RevokeOptions = PamYesOptions & { reason?: string };

/**
 * `bw privileged-controls approval`: the approver's side of Privileged Controls. Follows the web: an approver is
 * a member of an organization that uses PAM, not a provider user, with Manage on at least one of
 * its collections or the ability to edit all of its items (`hasApproverPrivileges`). Every command
 * refuses anyone else up front, with no SDK call, rather than showing an empty inbox. No command is
 * gated on an admin permission, since an admin without either is not an approver.
 */
export class ApprovalsProgram extends PamBaseProgram {
  command(): Command {
    return new Command("approval")
      .description("Review and decide access requests, and end the leases you approved.")
      .addCommand(this.inboxCommand())
      .addCommand(this.historyCommand())
      .addCommand(this.approveCommand())
      .addCommand(this.denyCommand())
      .addCommand(this.withdrawCommand())
      .addCommand(this.revokeLeaseCommand())
      .addCommand(this.managedLeasesCommand());
  }

  /** Runs `run` for an approver only; anyone else gets one clear refusal and no SDK call. */
  private async runApprover(run: (ctx: PamContext) => Promise<Response>): Promise<void> {
    await this.runPam({}, async (ctx) => {
      const refusal = await refuseNonApprover(this.serviceContainer, ctx.userId);
      return refusal ?? (await run(ctx));
    });
  }

  private service(): ApprovalsService {
    return new ApprovalsService(createPamSdkService(this.serviceContainer));
  }

  private async namesFor(options: PamNamesOptions): Promise<PamNames | undefined> {
    return options.names === true
      ? await createPamNameResolver(this.serviceContainer).load()
      : undefined;
  }

  private inboxCommand(): Command {
    const command = new Command("inbox")
      .description("List pending access requests waiting for your decision.")
      .action(async (options: PamNamesOptions) => {
        await this.runApprover(async (ctx) => {
          const rows = await this.service().inbox(ctx.userId);
          const names = await this.namesFor(options);
          return Response.success(
            new ListResponse(rows.map((row) => new ApprovalRowResponse(row, names))),
          );
        });
      });
    addNamesOption(command);
    return addPamHelp(command, {
      notes: [
        "Only approvers can use `bw privileged-controls approval`: members of an organization that uses Privileged Controls who have Manage on one of its collections, or who can edit all items in it (an owner or admin, only where the organization gives them access to all collection items). Anyone else is refused with a message, in every organization, like the web, which hides Approvals from them.",
        "Requests whose window has already ended are not listed.",
      ],
      examples: [
        "bw privileged-controls approval inbox",
        "bw privileged-controls approval inbox --names",
      ],
    });
  }

  private historyCommand(): Command {
    const command = new Command("history")
      .description("List the access requests you can manage that were already decided.")
      .action(async (options: PamNamesOptions) => {
        await this.runApprover(async (ctx) => {
          const rows = await this.service().history(ctx.userId);
          const names = await this.namesFor(options);
          return Response.success(
            new ListResponse(rows.map((row) => new ApprovalRowResponse(row, names))),
          );
        });
      });
    addNamesOption(command);
    return addPamHelp(command, { examples: ["bw privileged-controls approval history"] });
  }

  private approveCommand(): Command {
    const command = new Command("approve")
      .description("Approve a pending access request.")
      .argument("<requestId>", "The access request id")
      .option("--comment <text>", "An optional note shown to the requester.")
      .action(async (requestId: string, options: CommentOptions) => {
        await this.runApprover(async (ctx) => {
          const id = parseIdOption(requestId, "request id");
          return await decideRequest(this.service(), ctx.userId, id, "approve", options.comment);
        });
      });
    return addPamHelp(command, {
      notes: [
        "You cannot approve your own request; the server refuses it.",
        "If another approver decided first, or the window ended, this prints a notice and exits 0.",
      ],
      examples: [
        "bw privileged-controls approval approve <requestId>",
        'bw privileged-controls approval approve <requestId> --comment "ok"',
      ],
    });
  }

  private denyCommand(): Command {
    const command = new Command("deny")
      .description("Deny a pending access request. A comment is required.")
      .argument("<requestId>", "The access request id")
      .option("--comment <text>", "Why the request is denied (required, not blank).")
      .action(async (requestId: string, options: CommentOptions) => {
        await this.runApprover(async (ctx) => {
          const id = parseIdOption(requestId, "request id");
          return await decideRequest(this.service(), ctx.userId, id, "deny", options.comment);
        });
      });
    return addPamHelp(command, {
      notes: ["You cannot deny your own request; the server refuses it."],
      examples: ['bw privileged-controls approval deny <requestId> --comment "not needed"'],
    });
  }

  private withdrawCommand(): Command {
    const command = new Command("withdraw")
      .description("Withdraw an approval before the requester starts the access.")
      .argument("<requestId>", "The access request id")
      .action(async (requestId: string, options: PamYesOptions) => {
        await this.runApprover(async (ctx) => {
          const id = parseIdOption(requestId, "request id");
          const refusal = requireYes(options, "withdraw this approval");
          if (refusal != null) {
            return refusal;
          }
          return await withdrawRequest(this.service(), ctx.userId, id);
        });
      });
    addYesOption(command);
    return addPamHelp(command, {
      notes: [
        "Only an approved request that has not been started can be withdrawn.",
        "The server records a withdrawal as your denial, with no reason.",
      ],
      examples: ["bw privileged-controls approval withdraw <requestId> --yes"],
    });
  }

  private revokeLeaseCommand(): Command {
    const command = new Command("revoke-lease")
      .description("End a live lease early.")
      .argument("<leaseId>", "The lease id")
      .option("--reason <text>", "An optional note for the audit trail.")
      .action(async (leaseId: string, options: RevokeOptions) => {
        await this.runApprover(async (ctx) => {
          const id = parseIdOption(leaseId, "lease id");
          const refusal = requireYes(options, "end this lease now");
          if (refusal != null) {
            return refusal;
          }
          return await revokeLease(this.service(), ctx.userId, id, options.reason);
        });
      });
    addYesOption(command);
    return addPamHelp(command, {
      notes: ["Find lease ids with `bw privileged-controls approval managed-leases`."],
      examples: ["bw privileged-controls approval revoke-lease <leaseId> --yes"],
    });
  }

  private managedLeasesCommand(): Command {
    const command = new Command("managed-leases")
      .description("List the leases produced by requests you can manage.")
      .option("--all", "Include leases that already ended.")
      .action(async (options: PamNamesOptions & { all?: boolean }) => {
        await this.runApprover(async (ctx) => {
          const rows = await this.service().managedLeases(ctx.userId, options.all === true);
          const names = await this.namesFor(options);
          return Response.success(
            new ListResponse(rows.map((row) => new ManagedLeaseResponse(row, names))),
          );
        });
      });
    addNamesOption(command);
    return addPamHelp(command, {
      notes: [
        "Derived from the request history, since there is no organization-wide lease list. It covers requests you can manage.",
      ],
      examples: [
        "bw privileged-controls approval managed-leases",
        "bw privileged-controls approval managed-leases --all",
      ],
    });
  }
}
