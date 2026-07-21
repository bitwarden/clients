// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fs from "fs";
import * as path from "path";

import { firstValueFrom, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SendControlsPolicyData } from "@bitwarden/common/tools/models/send-controls-policy-data";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { NodeUtils } from "@bitwarden/node/node-utils";

import { Response } from "../../../models/response";
import { CliUtils } from "../../../utils";
import { SendTextResponse } from "../models/send-text.response";
import { SendResponse } from "../models/send.response";

export class SendCreateCommand {
  constructor(
    private sendService: SendService,
    private environmentService: EnvironmentService,
    private sendApiService: SendApiService,
    private accountProfileService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private policyService: PolicyService,
    private configService: ConfigService,
  ) {}

  async run(requestJson: any, cmdOptions: Record<string, any>) {
    let req: any = null;
    if (process.env.BW_SERVE !== "true" && (requestJson == null || requestJson === "")) {
      requestJson = await CliUtils.readStdin();
    }

    if (requestJson == null || requestJson === "") {
      return Response.badRequest("`requestJson` was not provided.");
    }

    if (typeof requestJson !== "string") {
      req = requestJson;
      req.deletionDate = req.deletionDate == null ? null : new Date(req.deletionDate);
      req.expirationDate = req.expirationDate == null ? null : new Date(req.expirationDate);
    } else {
      try {
        const reqJson = Buffer.from(requestJson, "base64").toString();
        req = SendResponse.fromJson(reqJson);

        if (req == null) {
          throw new Error("Null request");
        }
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        return Response.badRequest("Error parsing the encoded request data.");
      }
    }

    if (
      req.deletionDate == null ||
      isNaN(new Date(req.deletionDate).getTime()) ||
      new Date(req.deletionDate) <= new Date()
    ) {
      return Response.badRequest("Must specify a valid deletion date after the current time");
    }

    if (req.expirationDate != null && isNaN(new Date(req.expirationDate).getTime())) {
      return Response.badRequest("Unable to parse expirationDate: " + req.expirationDate);
    }

    const normalizedOptions = new Options(cmdOptions);
    return this.createSend(req, normalizedOptions);
  }

  private async createSend(req: SendResponse, options: Options) {
    const filePath = req.file?.fileName ?? options.file;
    const text = req.text?.text ?? options.text;
    const hidden = req.text?.hidden ?? options.hidden;
    const password = req.password ?? options.password ?? undefined;
    const emails = req.emails ?? options.emails ?? undefined;
    const maxAccessCount = req.maxAccessCount ?? options.maxAccessCount;

    const hasEmails = emails != null && emails.length > 0;
    const hasPassword = password != null && password.trim().length > 0;

    if (hasEmails && hasPassword) {
      return Response.badRequest("--password and --emails are mutually exclusive.");
    }

    req.key = null;
    req.maxAccessCount = maxAccessCount;
    req.emails = emails;

    if (hasEmails) {
      req.authType = AuthType.Email;
    } else if (hasPassword) {
      req.authType = AuthType.Password;
    } else {
      req.authType = AuthType.None;
    }

    const policyError = await this.enforceSendPolicy(req);
    if (policyError) {
      return policyError;
    }

    const hasPremium$ = this.accountService.activeAccount$.pipe(
      switchMap(({ id }) => this.accountProfileService.hasPremiumFromAnySource$(id)),
    );

    switch (req.type) {
      case SendType.File:
        if (process.env.BW_SERVE === "true") {
          return Response.error(
            "Creating a file-based Send is unsupported through the `serve` command at this time.",
          );
        }

        if (!(await firstValueFrom(hasPremium$))) {
          return Response.error("Premium status is required to use this feature.");
        }

        if (filePath == null) {
          return Response.badRequest(
            "Must specify a file to Send either with the --file option or in the request JSON.",
          );
        }

        req.file.fileName = path.basename(filePath);
        break;
      case SendType.Text:
        if (text == null) {
          return Response.badRequest(
            "Must specify text content to Send either with the --text option or in the request JSON.",
          );
        }
        req.text = new SendTextResponse();
        req.text.text = text;
        req.text.hidden = hidden;
        break;
      default:
        return Response.badRequest(
          "Unknown Send type " + SendType[req.type] + ". Valid types are: file, text",
        );
    }

    try {
      let fileBuffer: ArrayBuffer = null;
      if (req.type === SendType.File) {
        fileBuffer = NodeUtils.bufferToArrayBuffer(fs.readFileSync(filePath));
      }

      const sendView = SendResponse.toView(req);
      const [encSend, fileData] = await this.sendService.encrypt(sendView, fileBuffer, password);
      // Forward the plaintext password so the SDK path can derive the send password over the key it
      // generates; the legacy path ignores it.
      await this.sendApiService.save([encSend, fileData], password);
      const newSend = await this.sendService.getFromState(encSend.id);
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const decSend = await newSend.decrypt(activeUserId);
      const env = await firstValueFrom(this.environmentService.environment$);
      const res = new SendResponse(decSend, env.getSendUrl());
      return Response.success(res);
    } catch (e) {
      return Response.error(e);
    }
  }

  private async enforceSendPolicy(req: SendResponse): Promise<Response | null> {
    const sendControlsEnabled = await this.configService.getFeatureFlag(FeatureFlag.SendControls);
    if (!sendControlsEnabled) {
      return null;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const policies = await firstValueFrom(
      this.policyService.policiesByType$(PolicyType.SendControls, userId),
    );

    const whoCanAccessPolicyData = policies.find((p) => p.data?.whoCanAccess != null)?.data as
      | SendControlsPolicyData
      | undefined;
    if (whoCanAccessPolicyData?.whoCanAccess === WhoCanAccessType.SpecificPeople) {
      if (req.authType !== AuthType.Email || !req.emails?.length) {
        return Response.error(
          "Organization policy requires Send access to be restricted to specific people. Use --emails to specify recipients.",
        );
      }

      const rawDomains = whoCanAccessPolicyData?.allowedDomains;
      if (rawDomains) {
        const allowedDomains = rawDomains
          .split(",")
          .map((d: string) => d.trim().toLowerCase())
          .filter((d: string) => d.length > 0);

        if (allowedDomains.length > 0) {
          const disallowed = req.emails.filter((email) => {
            const domain = email.split("@")[1]?.toLowerCase();
            return !allowedDomains.includes(domain);
          });
          if (disallowed.length > 0) {
            return Response.error(
              `Organization policy restricts email domains. The following emails are not allowed: ${disallowed.join(", ")}. Allowed domains: ${allowedDomains.join(", ")}.`,
            );
          }
        }
      }
    } else if (whoCanAccessPolicyData?.whoCanAccess === WhoCanAccessType.PasswordProtected) {
      if (req.authType !== AuthType.Password) {
        return Response.error(
          "Organization policy requires Send access to be password protected. Use --password to set a password.",
        );
      }
    }
    // If org policy specifies a deletion date we comply with it, overriding what
    // the user has specified. This matches the UI behavior, where users are
    // barred from using other deletion dates when one is mandated by org policy.
    const deletionDatePolicyData = policies.find((p) => p.data?.deletionHours)?.data as
      | SendControlsPolicyData
      | undefined;
    if (deletionDatePolicyData?.deletionHours != null) {
      const policyCompliantDeletionDate = new Date();
      policyCompliantDeletionDate.setTime(
        policyCompliantDeletionDate.getTime() + deletionDatePolicyData.deletionHours * 3600000, // ms per hour
      );
      req.deletionDate = policyCompliantDeletionDate;
    }

    return null;
  }
}

class Options {
  file: string;
  text: string;
  maxAccessCount: number;
  password: string;
  emails: Array<string>;
  hidden: boolean;

  constructor(passedOptions: Record<string, any>) {
    this.file = passedOptions?.file;
    this.text = passedOptions?.text;
    this.password = passedOptions?.password;
    this.emails = passedOptions?.emails;
    this.hidden = CliUtils.convertBooleanOption(passedOptions?.hidden);
    this.maxAccessCount =
      passedOptions?.maxAccessCount != null ? parseInt(passedOptions.maxAccessCount, null) : null;
  }
}
