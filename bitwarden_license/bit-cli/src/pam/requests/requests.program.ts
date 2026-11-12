import { Command } from "commander";

import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  addNamesOption,
  addPamHelp,
  addReasonOptions,
  PamBaseProgram,
  PamNamesOptions,
  PamOrganizationRequirement,
  PamTextOptions,
  readReasonText,
} from "../shared";

import { createRequestOperations, RequestOperations } from "./request.operations";

type StatusOptions = PamNamesOptions & { precheck?: boolean };
type CreateOptions = PamTextOptions & { duration?: string; start?: string; end?: string };
type ListOptions = PamNamesOptions & { status?: string };

/**
 * `bw pam request`: the end user's access requests. A request never mints a lease; `activate`
 * does, and neither prints a credential.
 *
 * Gated ciphers may be hidden from the CLI device type by the server, so this group is subject to
 * the live check described in the README.
 */
export class RequestsProgram extends PamBaseProgram {
  private readonly operations: RequestOperations;

  constructor(serviceContainer: ServiceContainer, operations?: RequestOperations) {
    super(serviceContainer);
    this.operations = operations ?? createRequestOperations(serviceContainer);
  }

  command(): Command {
    return new Command("request")
      .description("Request, activate and track access to controlled items.")
      .addCommand(this.statusCommand())
      .addCommand(this.createCommand())
      .addCommand(this.listCommand())
      .addCommand(this.getCommand())
      .addCommand(this.activateCommand())
      .addCommand(this.cancelCommand());
  }

  private statusCommand(): Command {
    const command = new Command("status")
      .argument("<cipherId>", "The id of the controlled item.")
      .description("Show your access state for a controlled item.")
      .option(
        "--precheck",
        "Also show how a request would be approved: the approval mode, default and maximum duration, and whether a lease can start now.",
      )
      .action(async (cipherId: string, options: StatusOptions) => {
        await this.runPam({ requirement: PamOrganizationRequirement.UsePam }, (ctx) =>
          this.operations.status(ctx.userId, cipherId, options),
        );
      });
    addNamesOption(command);
    return addPamHelp(command, {
      notes: [
        "The state is the one the server reports for you. An active lease whose window has closed is reported as lapsed.",
      ],
      examples: [
        "bw pam request status 6bd7a1c4-1f2e-4a5b-9c3d-0e8f7a6b5c4d",
        "bw pam request status 6bd7a1c4-1f2e-4a5b-9c3d-0e8f7a6b5c4d --precheck",
      ],
    });
  }

  private createCommand(): Command {
    const command = new Command("create")
      .argument("<cipherId>", "The id of the controlled item.")
      .description("Request access to a controlled item.")
      .option("--duration <duration>", "How long the lease should run, such as 30m, 2h or 1d.")
      .option("--start <date>", "The start of the window, as an ISO 8601 date and time.")
      .option("--end <date>", "The end of the window, as an ISO 8601 date and time.")
      .action(async (cipherId: string, options: CreateOptions) => {
        await this.runPam({ requirement: PamOrganizationRequirement.AccessPam }, async (ctx) => {
          // Read before the first request, so a bad reason source fails without a round trip.
          const reason = await readReasonText(options);
          return await this.operations.create(ctx.userId, {
            cipherId,
            duration: options.duration,
            start: options.start,
            end: options.end,
            reason,
          });
        });
      });
    addReasonOptions(command);
    return addPamHelp(command, {
      notes: [
        "The CLI checks how the item is approved first. An automatic item needs --duration, or uses its default. An item that needs human approval needs --start, --end and a reason, and the window may not be longer than the item's maximum or 365 days.",
        "A reason is never printed or logged. Prefer --reasonfile or --reasonstdin to keep it out of shell history.",
        "Creating a request does not start a lease. Run `bw pam request activate <requestId>` to start it. This needs a Privileged Controls seat.",
      ],
      examples: [
        "bw pam request create 6bd7a1c4-1f2e-4a5b-9c3d-0e8f7a6b5c4d --duration 2h",
        'bw pam request create 6bd7a1c4-1f2e-4a5b-9c3d-0e8f7a6b5c4d --start 2026-03-01T09:00:00Z --end 2026-03-01T11:00:00Z --reason "Quarterly key rotation"',
      ],
    });
  }

  private listCommand(): Command {
    const command = new Command("list")
      .description("List your access requests, newest first.")
      .option(
        "--status <status>",
        "Only requests with this status: pending, approved, denied, canceled or expired.",
      )
      .action(async (options: ListOptions) => {
        await this.runPam({ requirement: PamOrganizationRequirement.UsePam }, (ctx) =>
          this.operations.list(ctx.userId, options),
        );
      });
    addNamesOption(command);
    return addPamHelp(command, {
      notes: [
        "Extension requests are shown on the request they extend. Activation is not a status: an activated request is approved and shows producedLeaseId and producedLeaseStatus.",
      ],
      examples: ["bw pam request list", "bw pam request list --status pending"],
    });
  }

  private getCommand(): Command {
    const command = new Command("get")
      .argument("<requestId>", "The id of the request.")
      .description("Show one access request.")
      .action(async (requestId: string, options: PamNamesOptions) => {
        await this.runPam({ requirement: PamOrganizationRequirement.UsePam }, (ctx) =>
          this.operations.get(ctx.userId, requestId, options),
        );
      });
    addNamesOption(command);
    return addPamHelp(command, {
      examples: ["bw pam request get 0c9d2e3f-4a5b-4c6d-8e7f-1a2b3c4d5e6f"],
    });
  }

  private activateCommand(): Command {
    const command = new Command("activate")
      .argument("<requestId>", "The id of an approved request.")
      .description("Start the lease for an approved request.")
      .action(async (requestId: string) => {
        await this.runPam(
          { requirement: PamOrganizationRequirement.AccessPam },
          (ctx): Promise<Response> => this.operations.activate(ctx.userId, requestId),
        );
      });
    return addPamHelp(command, {
      notes: [
        "The request must be approved and inside its window, and no one else may hold the item's lease. This needs a Privileged Controls seat.",
        "Activation never shows the credential.",
      ],
      examples: ["bw pam request activate 0c9d2e3f-4a5b-4c6d-8e7f-1a2b3c4d5e6f"],
    });
  }

  private cancelCommand(): Command {
    const command = new Command("cancel")
      .argument("<requestId>", "The id of your request.")
      .description("Cancel your own request while it is pending or approved and not yet activated.")
      .action(async (requestId: string) => {
        await this.runPam({ requirement: PamOrganizationRequirement.UsePam }, (ctx) =>
          this.operations.cancel(ctx.userId, requestId),
        );
      });
    return addPamHelp(command, {
      examples: ["bw pam request cancel 0c9d2e3f-4a5b-4c6d-8e7f-1a2b3c4d5e6f"],
    });
  }
}
