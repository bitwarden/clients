import { Command, OptionValues } from "commander";
import { firstValueFrom } from "rxjs";

import {
  LeasesService,
  parseRevealField,
  LEASE_REVEAL_FIELDS,
} from "@bitwarden/bit-common/pam/leases";
import {
  parseDuration,
  PAM_IDS_ONLY,
  PamInputError,
  sdkIdToString,
} from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { StringResponse } from "@bitwarden/cli/models/response/string.response";

import { ServiceContainer } from "../../service-container";
import {
  addNamesOption,
  addPamHelp,
  addReasonOptions,
  addYesOption,
  createPamNameResolver,
  createPamSdkService,
  PamBaseProgram,
  PamNamesOptions,
  PamOrganizationRequirement,
  PamTextOptions,
  PamYesOptions,
  readReasonText,
  requireYes,
} from "../shared";

import { LeaseChangeResponse, LeaseResponse } from "./lease.response";

/** `bw pam lease`: list, extend, end and reveal. */
export class LeasesProgram extends PamBaseProgram {
  private readonly leases: LeasesService;

  constructor(serviceContainer: ServiceContainer) {
    super(serviceContainer);
    this.leases = new LeasesService(createPamSdkService(serviceContainer));
  }

  command(): Command {
    return new Command("lease")
      .description("List, extend, end and reveal your privileged access leases.")
      .addCommand(this.listCommand())
      .addCommand(this.extendCommand())
      .addCommand(this.endCommand())
      .addCommand(this.revealCommand());
  }

  private listCommand(): Command {
    const command = new Command("list")
      .description("List your leases.")
      .option("--active", "Only leases whose access window is still open.")
      .action(async (options: OptionValues & PamNamesOptions & { active?: boolean }) => {
        await this.runPam({ requirement: PamOrganizationRequirement.UsePam }, async (ctx) => {
          const leases = await this.leases.list(ctx.userId, options.active === true);
          const names =
            options.names === true
              ? await createPamNameResolver(this.serviceContainer).load()
              : PAM_IDS_ONLY;
          const rows = leases.map((l) => {
            const id = sdkIdToString(l.cipherId);
            const name = names.cipher(id);
            return new LeaseResponse(l, name === id ? undefined : name);
          });
          return Response.success(new ListResponse(rows));
        });
      });
    addNamesOption(command);
    return addPamHelp(command, {
      examples: ["bw pam lease list", "bw pam lease list --active", "bw pam lease list --names"],
    });
  }

  private extendCommand(): Command {
    const command = new Command("extend")
      .argument("<leaseId>", "The lease id")
      .description("Extend a live lease.")
      .requiredOption("--duration <duration>", "How long to extend by: 30m, 2h, 1d or seconds.")
      .action(async (leaseId: string, options: OptionValues & PamTextOptions) => {
        await this.runPam({ requirement: PamOrganizationRequirement.AccessPam }, async (ctx) => {
          const durationSeconds = parseDuration(options.duration as string, "--duration");
          const reason = await readReasonText(options, { required: true });
          const result = await this.leases.extend(
            ctx.userId,
            leaseId,
            durationSeconds,
            reason as string,
          );
          return Response.success(new LeaseChangeResponse(result.leaseId, result.status, result));
        });
      });
    addReasonOptions(command);
    return addPamHelp(command, {
      notes: [
        "A reason is required. The duration must fit the rule's maximum extension, and the rule must allow extensions.",
        "A lease that has already ended cannot be extended: the command fails with `The lease has ended`.",
      ],
      examples: ['bw pam lease extend <leaseId> --duration 1h --reason "Deploy is still running"'],
    });
  }

  private endCommand(): Command {
    const command = new Command("end")
      .argument("<leaseId>", "The lease id")
      .description("End a lease early. Your own lease settles to canceled; an approver revokes.")
      .action(async (leaseId: string, options: OptionValues & PamTextOptions & PamYesOptions) => {
        await this.runPam({ requirement: PamOrganizationRequirement.UsePam }, async (ctx) => {
          const refusal = requireYes(options, "end this lease");
          if (refusal != null) {
            return refusal;
          }
          const reason = await readReasonText(options, { required: false });
          const id = await this.leases.end(ctx.userId, leaseId, reason);
          return Response.success(new LeaseChangeResponse(id, "ended"));
        });
      });
    addReasonOptions(command);
    addYesOption(command);
    return addPamHelp(command, {
      notes: [
        "Needs no Privileged Controls seat, so an approver or admin can also use it to revoke a live lease.",
      ],
      examples: [
        "bw pam lease end <leaseId> --yes",
        'bw pam lease end <leaseId> --reason "Done" --yes',
      ],
    });
  }

  private revealCommand(): Command {
    const command = new Command("reveal")
      .argument("<cipherId>", "The cipher id")
      .description("Print one field of a leased item to stdout.")
      .requiredOption("--field <field>", `One of ${LEASE_REVEAL_FIELDS.join(", ")}.`)
      .action(async (cipherId: string, options: OptionValues) => {
        await this.runPam({ requirement: PamOrganizationRequirement.AccessPam }, async (ctx) => {
          const field = parseRevealField(options.field as string);
          const value = await this.leases.reveal(ctx.userId, cipherId, field);
          if (field !== "totp") {
            return Response.success(new StringResponse(value));
          }
          const totp = await firstValueFrom(this.serviceContainer.totpService.getCode$(value));
          if (!totp?.code) {
            throw new PamInputError("Couldn't generate TOTP code.");
          }
          return Response.success(new StringResponse(totp.code));
        });
      });
    return addPamHelp(command, {
      notes: [
        "Prints only the requested field, to stdout. It needs a live lease and fails with `access not available` otherwise.",
        "This is the only `bw pam` command that prints a secret. It is not available over `bw serve`.",
      ],
      examples: ["bw pam lease reveal <cipherId> --field password"],
    });
  }
}
