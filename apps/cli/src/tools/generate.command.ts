import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { VendorId } from "@bitwarden/common/tools/extension";
import { isDynamic } from "@bitwarden/common/tools/state/state-constraints-dependency";
import { Constraint, Constraints } from "@bitwarden/common/tools/types";
import {
  BuiltIn,
  CredentialGeneratorService,
  GeneratorMetadata,
  providers,
} from "@bitwarden/generator-core";

import { Response } from "../models/response";
import { StringResponse } from "../models/response/string.response";

interface GenerateCmdOptions {
  passphrase?: boolean;
  username?: boolean;
  email?: string;
  forwardedService?: string;
  uppercase?: boolean;
  lowercase?: boolean;
  number?: boolean;
  special?: boolean;
  length?: string;
  minNumber?: string;
  minSpecial?: string;
  ambiguous?: boolean;
  words?: string;
  separator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
  apiKey?: string;
  domain?: string;
  emailAddress?: string;
  catchallType?: string;
  subaddressType?: string;
  baseUrl?: string;
  prefix?: string;
  website?: string;
}

export class GenerateCommand {
  constructor(
    private generatorService: CredentialGeneratorService,
    private generatorProvider: providers.GeneratorDependencyProvider,
    private accountService: AccountService,
  ) {}

  async run(cmdOptions: GenerateCmdOptions): Promise<Response> {
    const options = cmdOptions ?? {};
    const account = await firstValueFrom(this.accountService.activeAccount$);

    // CredentialGeneratorService requires a valid account
    if (account == null) {
      return Response.error("You are not logged in.");
    }

    let metadata: GeneratorMetadata<any>;
    let flagOverrides: Record<string, unknown>;
    try {
      ({ metadata, flagOverrides } = this.resolveAlgorithm(options));
    } catch (e: unknown) {
      return Response.badRequest(e instanceof Error ? e.message : String(e));
    }

    const account$ = new BehaviorSubject(account);
    try {
      const policyConstraints = await firstValueFrom(
        this.generatorService.policy$(metadata, { account$ }),
      );

      const settingsSubject = this.generatorService.settings(metadata, { account$ });
      const savedSettings = await firstValueFrom(settingsSubject);

      const defaultConstraints = metadata.profiles?.account?.constraints?.default ?? {};
      const { hardLimits, clampedOverrides } = this.applyHardLimits(
        flagOverrides,
        defaultConstraints,
      );

      if (hardLimits.length > 0) {
        return Response.badRequest(`${hardLimits.join("; ")}.`);
      }

      const requestedSettings = { ...savedSettings, ...clampedOverrides };

      const adjustResult = isDynamic(policyConstraints)
        ? policyConstraints.calibrate(requestedSettings).adjust(requestedSettings)
        : policyConstraints.adjust(requestedSettings);
      const policyAdjustedSettings = adjustResult.state;
      const applied = adjustResult.applied;

      // Report policy adjustments using the framework's `applied` field
      const adjustments = this.describeAppliedConstraints(
        requestedSettings,
        policyAdjustedSettings,
        applied,
      );
      if (adjustments.length > 0) {
        const isOrgPolicy = policyConstraints.constraints.policyInEffect;
        const lines = adjustments.map((a) => `  - ${a}`).join("\n");
        const policyName = isOrgPolicy ? "Organization policy" : "Default policy";
        return Response.badRequest(`${policyName} requires different settings:\n${lines}`);
      }

      const finalSettings = policyAdjustedSettings;

      const websiteNameCredential = this.tryWebsiteNameGeneration(finalSettings, options.website);
      if (websiteNameCredential != null) {
        return Response.success(new StringResponse(websiteNameCredential));
      }

      const engine = metadata.engine.create(this.generatorProvider);
      const generated = await engine.generate(
        { algorithm: metadata.id, website: options.website },
        finalSettings,
      );

      return Response.success(new StringResponse(generated.credential));
    } finally {
      account$.complete();
    }
  }

  private tryWebsiteNameGeneration(
    settings: Record<string, unknown>,
    website: string | undefined,
  ): string | null {
    if (!website) {
      return null;
    }

    const siteName = this.extractSiteName(website);
    if (!siteName) {
      return null;
    }

    if (settings.catchallType === "website-name" && settings.catchallDomain) {
      return `${siteName}@${settings.catchallDomain}`;
    }

    if (settings.subaddressType === "website-name" && settings.subaddressEmail) {
      const email = settings.subaddressEmail as string;
      const atIndex = email.indexOf("@");
      if (atIndex < 0) {
        return null;
      }
      const username = email.substring(0, atIndex);
      const domain = email.substring(atIndex);
      return `${username}+${siteName}${domain}`;
    }

    return null;
  }

  private extractSiteName(website: string): string {
    const dotIndex = website.lastIndexOf(".");
    return dotIndex > 0 ? website.substring(0, dotIndex) : website;
  }

  private applyHardLimits(
    flagOverrides: Record<string, unknown>,
    defaultConstraints: Constraints<any>,
  ): { hardLimits: string[]; clampedOverrides: Record<string, unknown> } {
    const hardLimits: string[] = [];
    const clampedOverrides = { ...flagOverrides };

    for (const [key, value] of Object.entries(clampedOverrides)) {
      const constraint = defaultConstraints[key];
      if (constraint == null || typeof value !== "number") {
        continue;
      }
      if ("max" in constraint && value > (constraint.max ?? Infinity)) {
        hardLimits.push(`${key} has a maximum of ${constraint.max} (requested ${value})`);
        clampedOverrides[key] = constraint.max;
      } else if ("min" in constraint && value < (constraint.min ?? -Infinity)) {
        hardLimits.push(`${key} has a minimum of ${constraint.min} (requested ${value})`);
        clampedOverrides[key] = constraint.min;
      }
    }

    return { hardLimits, clampedOverrides };
  }

  private describeAppliedConstraints(
    requested: Record<string, unknown>,
    adjusted: Record<string, unknown>,
    applied: Constraints<any>,
  ): string[] {
    const descriptions: string[] = [];
    for (const key of Object.keys(applied)) {
      const constraint = applied[key] as Constraint<any>;
      const before = requested[key];
      const after = adjusted[key];
      if (JSON.stringify(before) === JSON.stringify(after)) {
        continue;
      }
      const beforeStr = this.formatValue(before);
      const afterStr = this.formatValue(after);
      const reason = this.formatConstraintReason(constraint);
      descriptions.push(
        reason
          ? `${key}: ${beforeStr} → ${afterStr} (${reason})`
          : `${key}: ${beforeStr} → ${afterStr}`,
      );
    }
    return descriptions;
  }

  private formatValue(value: unknown): string {
    if (typeof value === "boolean") {
      return value ? "on" : "off";
    }
    return String(value ?? "unset");
  }

  private formatConstraintReason(constraint: Constraint<any>): string {
    // BooleanConstraint
    if ("requiredValue" in constraint && constraint.requiredValue === true) {
      return "required by policy";
    }
    // NumberConstraints
    if ("min" in constraint || "max" in constraint) {
      if (constraint.min != null && constraint.max != null) {
        return `policy requires ${constraint.min}–${constraint.max}`;
      } else if (constraint.min != null) {
        return `policy minimum is ${constraint.min}`;
      } else if (constraint.max != null) {
        return `policy maximum is ${constraint.max}`;
      }
    }
    // TODO: Add StringConstraints messaging
    return "";
  }

  private resolveAlgorithm(options: GenerateCmdOptions): {
    metadata: GeneratorMetadata<any>;
    flagOverrides: Record<string, unknown>;
  } {
    if (options.username) {
      return { metadata: BuiltIn.effWordList, flagOverrides: this.buildUsernameSettings(options) };
    }

    if (options.email === "catchall") {
      return { metadata: BuiltIn.catchall, flagOverrides: this.buildCatchallSettings(options) };
    }

    if (options.email === "subaddress") {
      return {
        metadata: BuiltIn.plusAddress,
        flagOverrides: this.buildSubaddressSettings(options),
      };
    }

    if (options.email === "forwarded") {
      return this.resolveForwarder(options);
    }

    if (options.passphrase) {
      return { metadata: BuiltIn.passphrase, flagOverrides: this.buildPassphraseSettings(options) };
    }

    return { metadata: BuiltIn.password, flagOverrides: this.buildPasswordSettings(options) };
  }

  private buildPasswordSettings(options: GenerateCmdOptions): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    if (options.uppercase != null) {
      settings.uppercase = options.uppercase;
    }
    if (options.lowercase != null) {
      settings.lowercase = options.lowercase;
    }
    if (options.number != null) {
      settings.number = options.number;
    }
    if (options.special != null) {
      settings.special = options.special;
    }
    if (options.length != null) {
      settings.length = this.parseIntOrThrow(options.length, "length");
    }
    if (options.minNumber != null) {
      settings.minNumber = this.parseIntOrThrow(options.minNumber, "minNumber");
    }
    if (options.minSpecial != null) {
      settings.minSpecial = this.parseIntOrThrow(options.minSpecial, "minSpecial");
    }
    if (options.ambiguous != null) {
      settings.ambiguous = !options.ambiguous;
    }

    return settings;
  }

  private buildPassphraseSettings(options: GenerateCmdOptions): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    if (options.words != null) {
      settings.numWords = this.parseIntOrThrow(options.words, "words");
    }
    if (options.separator != null) {
      let separator = options.separator;
      if (separator === "space") {
        separator = " ";
      } else if (separator === "empty") {
        separator = "";
      } else if (separator.length > 1) {
        separator = separator[0];
      }
      settings.wordSeparator = separator;
    }
    if (options.capitalize != null) {
      settings.capitalize = options.capitalize;
    }
    if (options.includeNumber != null) {
      settings.includeNumber = options.includeNumber;
    }

    return settings;
  }

  private buildUsernameSettings(options: GenerateCmdOptions): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    if (options.capitalize != null) {
      settings.wordCapitalize = options.capitalize;
    }
    if (options.includeNumber != null) {
      settings.wordIncludeNumber = options.includeNumber;
    }

    return settings;
  }

  private buildCatchallSettings(options: GenerateCmdOptions): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    if (options.domain != null) {
      settings.catchallDomain = options.domain;
    }
    if (options.catchallType != null) {
      settings.catchallType = options.catchallType;
    }
    if (options.website != null) {
      settings.website = options.website;
    }

    return settings;
  }

  private buildSubaddressSettings(options: GenerateCmdOptions): Record<string, unknown> {
    const settings: Record<string, unknown> = {};

    if (options.emailAddress != null) {
      settings.subaddressEmail = options.emailAddress;
    }
    if (options.subaddressType != null) {
      settings.subaddressType = options.subaddressType;
    }
    if (options.website != null) {
      settings.website = options.website;
    }

    return settings;
  }

  private resolveForwarder(options: GenerateCmdOptions): {
    metadata: GeneratorMetadata<any>;
    flagOverrides: Record<string, unknown>;
  } {
    const vendorId = options.forwardedService as VendorId;
    if (!vendorId) {
      throw new Error("--forwarded-service is required when using --email forwarded");
    }

    const metadata = this.generatorService.forwarder(vendorId);

    const flagOverrides: Record<string, unknown> = {};
    if (options.apiKey != null) {
      flagOverrides.token = options.apiKey;
    }
    if (options.domain != null) {
      flagOverrides.domain = options.domain;
    }
    if (options.baseUrl != null) {
      flagOverrides.baseUrl = options.baseUrl;
    }
    if (options.prefix != null) {
      flagOverrides.prefix = options.prefix;
    }

    return { metadata, flagOverrides };
  }

  private parseIntOrThrow(value: string, name: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`--${name} must be a number (received "${value}")`);
    }
    return parsed;
  }
}
