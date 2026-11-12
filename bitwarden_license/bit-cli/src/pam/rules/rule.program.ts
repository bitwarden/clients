import { Command } from "commander";

import { parseAccessRuleJson } from "@bitwarden/bit-common/pam/rules";
import { Response } from "@bitwarden/cli/models/response";
import { CliUtils } from "@bitwarden/cli/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { ServiceContainer } from "../../service-container";
import {
  pamErrorResponse,
  addNamesOption,
  addOrganizationIdOption,
  addPamHelp,
  addYesOption,
  PamBaseProgram,
  PamNamesOptions,
  PamOrganizationOptions,
  PamOrganizationRequirement,
  PamYesOptions,
  requireYes,
} from "../shared";

import { readRuleJson, RuleInputOptions } from "./rule-input";
import { bypassWarning, RuleOperations } from "./rule-operations";

type ReadOptions = PamOrganizationOptions & PamNamesOptions;
type WriteOptions = PamOrganizationOptions & RuleInputOptions;
type DestructiveOptions = PamOrganizationOptions & PamYesOptions;

/**
 * `bw pam rule`: access rule administration. Reads (`list`, `get`, `bypassable`) are open to any
 * confirmed member of an organization that uses Privileged Controls and carry no admin pre-check;
 * writes need `canManageAccessRules`. The server stays the authority for both.
 */
export class RuleProgram extends PamBaseProgram {
  private operations: RuleOperations;

  constructor(serviceContainer: ServiceContainer) {
    super(serviceContainer);
    this.operations = new RuleOperations(serviceContainer);
  }

  /** Reads need an organization that uses Privileged Controls, but no admin right. */
  private readGuard(options: PamOrganizationOptions) {
    return {
      organizationId: options.organizationid,
      requirement: PamOrganizationRequirement.UsePam,
    };
  }

  command(): Command {
    return new Command("rule")
      .description("Manage access rules: which collections need a lease, and how it is granted.")
      .addCommand(this.listCommand())
      .addCommand(this.getCommand())
      .addCommand(this.templateCommand())
      .addCommand(this.createCommand())
      .addCommand(this.updateCommand())
      .addCommand(this.enableCommand())
      .addCommand(this.disableCommand())
      .addCommand(this.deleteCommand())
      .addCommand(this.bypassableCommand())
      .addCommand(this.validateCidrCommand());
  }

  private listCommand(): Command {
    const command = addNamesOption(
      addOrganizationIdOption(new Command("list").description("List the access rules.")),
    ).action(async (options: ReadOptions) => {
      await this.runPam(this.readGuard(options), async (ctx) => {
        return await this.operations.list(ctx.userId, ctx.organizationId!, options.names === true);
      });
    });
    return addPamHelp(command, {
      examples: ["bw pam rule list --organizationid <organizationId>"],
    });
  }

  private getCommand(): Command {
    const command = addNamesOption(
      addOrganizationIdOption(
        new Command("get").description("Get an access rule.").argument("<ruleId>"),
      ),
    ).action(async (ruleId: string, options: ReadOptions) => {
      await this.runPam(this.readGuard(options), async (ctx) => {
        return await this.operations.get(
          ctx.userId,
          ctx.organizationId!,
          ruleId,
          options.names === true,
        );
      });
    });
    return addPamHelp(command, {
      examples: ["bw pam rule get <ruleId> --organizationid <organizationId> --names"],
    });
  }

  private templateCommand(): Command {
    const command = new Command("template")
      .description("Print a skeleton rule for `create` and `update`.")
      .action(async () => {
        await this.exitIfFeatureFlagDisabled(FeatureFlag.Pam);
        this.processResponse(this.operations.template());
      });
    return addPamHelp(command, { examples: ["bw pam rule template > rule.json"] });
  }

  private createCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("create")
        .description("Create an access rule from JSON.")
        .argument("[json]", "The rule as JSON, or base64 of JSON. Omit it to read standard input.")
        .option("--file <path>", "Read the rule from a file."),
    ).action(async (json: string | undefined, options: WriteOptions) => {
      await this.runPam(
        {
          organizationId: options.organizationid,
          requirement: PamOrganizationRequirement.ManageAccessRules,
        },
        async (ctx) => {
          const input = parseAccessRuleJson(await readRuleJson(json, options));
          return await this.operations.create(ctx.userId, ctx.organizationId!, input);
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "The rule is the JSON `bw pam rule template` prints. `collections` is the whole set of collections the rule governs, and a collection can have one rule.",
        "Durations are exact seconds, up to 365 days.",
      ],
      examples: [
        "bw pam rule create --file rule.json --organizationid <organizationId>",
        "cat rule.json | bw pam rule create --organizationid <organizationId>",
      ],
    });
  }

  private updateCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("update")
        .description("Replace an access rule with the given JSON.")
        .argument("<ruleId>")
        .argument("[json]", "The rule as JSON, or base64 of JSON. Omit it to read standard input.")
        .option("--file <path>", "Read the rule from a file."),
    ).action(async (ruleId: string, json: string | undefined, options: WriteOptions) => {
      await this.runPam(
        {
          organizationId: options.organizationid,
          requirement: PamOrganizationRequirement.ManageAccessRules,
        },
        async (ctx) => {
          const input = parseAccessRuleJson(await readRuleJson(json, options));
          const result = await this.operations.update(
            ctx.userId,
            ctx.organizationId!,
            ruleId,
            input,
          );
          if (result.changed) {
            this.warn(bypassWarning("updated", result.bypassable));
          }
          return result.response;
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "The JSON replaces the whole rule, including its collections: any collection left out is no longer governed. Every field except the optional durations and description must be stated.",
      ],
      examples: ["bw pam rule update <ruleId> --file rule.json --organizationid <organizationId>"],
    });
  }

  private enableCommand(): Command {
    const command = addOrganizationIdOption(
      new Command("enable").description("Enable an access rule.").argument("<ruleId>"),
    ).action(async (ruleId: string, options: PamOrganizationOptions) => {
      await this.runPam(
        {
          organizationId: options.organizationid,
          requirement: PamOrganizationRequirement.ManageAccessRules,
        },
        async (ctx) => await this.operations.enable(ctx.userId, ctx.organizationId!, ruleId),
      );
    });
    return addPamHelp(command, {
      examples: ["bw pam rule enable <ruleId> --organizationid <organizationId>"],
    });
  }

  private disableCommand(): Command {
    const command = addYesOption(
      addOrganizationIdOption(
        new Command("disable").description("Disable an access rule.").argument("<ruleId>"),
      ),
    ).action(async (ruleId: string, options: DestructiveOptions) => {
      await this.runPam(
        {
          organizationId: options.organizationid,
          requirement: PamOrganizationRequirement.ManageAccessRules,
        },
        async (ctx) => {
          const refusal = requireYes(
            options,
            "disable this rule, which makes its collections reachable without a lease",
          );
          if (refusal != null) {
            return refusal;
          }
          const result = await this.operations.disable(ctx.userId, ctx.organizationId!, ruleId);
          if (result.changed) {
            this.warn(bypassWarning("disabled", result.bypassable));
          }
          return result.response;
        },
      );
    });
    return addPamHelp(command, {
      notes: [
        "A disabled rule no longer gates its collections, so their ciphers can be read without a lease. Needs --yes.",
      ],
      examples: ["bw pam rule disable <ruleId> --organizationid <organizationId> --yes"],
    });
  }

  private deleteCommand(): Command {
    const command = addYesOption(
      addOrganizationIdOption(
        new Command("delete").description("Delete an access rule.").argument("<ruleId>"),
      ),
    ).action(async (ruleId: string, options: DestructiveOptions) => {
      await this.runPam(
        {
          organizationId: options.organizationid,
          requirement: PamOrganizationRequirement.ManageAccessRules,
        },
        async (ctx) => {
          const refusal = requireYes(
            options,
            "permanently delete this rule, which makes its collections reachable without a lease",
          );
          if (refusal != null) {
            return refusal;
          }
          const result = await this.operations.delete(ctx.userId, ctx.organizationId!, ruleId);
          this.warn(bypassWarning("deleted", result.bypassable, result.ungoverned));
          return result.response;
        },
      );
    });
    return addPamHelp(command, {
      notes: ["A delete is permanent: there is no undo. Needs --yes."],
      examples: ["bw pam rule delete <ruleId> --organizationid <organizationId> --yes"],
    });
  }

  private bypassableCommand(): Command {
    const command = addNamesOption(
      addOrganizationIdOption(
        new Command("bypassable")
          .description("List the collections that expose a rule's ciphers without a lease.")
          .argument("<ruleId>"),
      ),
    ).action(async (ruleId: string, options: ReadOptions) => {
      await this.runPam(this.readGuard(options), async (ctx) => {
        return await this.operations.bypassable(
          ctx.userId,
          ctx.organizationId!,
          ruleId,
          options.names === true,
        );
      });
    });
    return addPamHelp(command, {
      notes: ["A rule that does not exist answers with an empty list."],
      examples: ["bw pam rule bypassable <ruleId> --organizationid <organizationId>"],
    });
  }

  private validateCidrCommand(): Command {
    const command = new Command("validate-cidr")
      .description("Check whether each value is a valid CIDR range. Works offline.")
      .argument("<cidr...>")
      .action(async (cidrs: string[]) => {
        await this.exitIfFeatureFlagDisabled(FeatureFlag.Pam);
        let response: Response;
        try {
          response = this.operations.validateCidr(cidrs);
        } catch (e) {
          response = pamErrorResponse(e);
        }
        this.processResponse(response);
      });
    return addPamHelp(command, {
      examples: ["bw pam rule validate-cidr 10.0.0.0/8 2001:db8::/32"],
    });
  }

  /** Prints a warning to stderr, unless `BW_QUIET` is set. */
  private warn(text: string | undefined) {
    if (text != null && process.env.BW_QUIET !== "true") {
      CliUtils.writeLn(text, true, true);
    }
  }
}
