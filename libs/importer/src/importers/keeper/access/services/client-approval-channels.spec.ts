/**
 * This is a magic line that tricks Jest into adding subtle.crypto to the test environment.
 * @jest-environment node
 */
import { create } from "@bufbuild/protobuf";
import { mock } from "jest-mock-extended";

import { DeviceApprovalChannel, KeeperRegion } from "../enums";
import { LoginResponseSchema, TwoFactorChannelType } from "../generated/api-request_pb";
import { Ui } from "../ui";

import { Client } from "./client";

const fixed = [
  DeviceApprovalChannel.Email,
  DeviceApprovalChannel.KeeperPush,
  DeviceApprovalChannel.TwoFactor,
];

const responseWith = (...channelTypes: TwoFactorChannelType[]) =>
  create(LoginResponseSchema, { channels: channelTypes.map((channelType) => ({ channelType })) });

const channelsFor = (
  accountDeviceApproval: boolean | undefined,
  ...channelTypes: TwoFactorChannelType[]
): DeviceApprovalChannel[] => {
  const client = new Client({ region: KeeperRegion.Us, ui: mock<Ui>(), accountDeviceApproval });
  return (client as any).approvalChannelsFor(responseWith(...channelTypes), fixed);
};

describe("Keeper client: device approval choices", () => {
  it("keeps the fixed list unless the account option is on", () => {
    expect(channelsFor(undefined, TwoFactorChannelType.TWO_FA_CT_DNA)).toEqual(fixed);
    expect(channelsFor(false, TwoFactorChannelType.TWO_FA_CT_DNA)).toEqual(fixed);
  });

  it("keeps the fixed list when the server sent no channels", () => {
    expect(channelsFor(true)).toEqual(fixed);
  });

  it("keeps Two-factor method for an authenticator or text message account, without Keeper DNA", () => {
    expect(channelsFor(true, TwoFactorChannelType.TWO_FA_CT_TOTP)).toEqual(fixed);
    expect(channelsFor(true, TwoFactorChannelType.TWO_FA_CT_SMS)).toEqual(fixed);
  });

  it("adds Keeper DNA after the others when the account has it", () => {
    expect(channelsFor(true, TwoFactorChannelType.TWO_FA_CT_DNA)).toEqual([
      ...fixed,
      DeviceApprovalChannel.KeeperDna,
    ]);
  });

  it("drops Two-factor method when the account has only methods the importer can't use", () => {
    expect(
      channelsFor(
        true,
        TwoFactorChannelType.TWO_FA_CT_DUO,
        TwoFactorChannelType.TWO_FA_CT_RSA,
        TwoFactorChannelType.TWO_FA_CT_U2F,
      ),
    ).toEqual([DeviceApprovalChannel.Email, DeviceApprovalChannel.KeeperPush]);
  });

  it("never drops Email or Keeper Push", () => {
    const kept = channelsFor(true, TwoFactorChannelType.TWO_FA_CT_WEBAUTHN);

    expect(kept).toContain(DeviceApprovalChannel.Email);
    expect(kept).toContain(DeviceApprovalChannel.KeeperPush);
  });
});
