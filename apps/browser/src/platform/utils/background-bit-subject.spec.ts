import mock from "jest-mock-extended/lib/Mock";

import { BitSubject } from "@bitwarden/common/platform/misc/bit-subject";

import { BrowserApi } from "../browser/browser-api";

import { BackgroundBitSubject } from "./background-bit-subject";

jest.mock("../browser/browser-api", () => {
  return {
    BrowserApi: mock<BrowserApi>(),
  };
});

describe("BackgroundBitSubject", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("it should set up a message listeners", () => {
    new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    expect(BrowserApi.messageListener).toHaveBeenCalledTimes(2);
  });

  it("should call next when a message is received from the foreground", () => {
    const subject = new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    const spy = jest.spyOn(subject, "next");
    (BrowserApi.messageListener as jest.Mock).mock.calls[0][1]({
      command: subject["fromForegroundMessageName"],
      data: "test",
    });
    expect(spy).toHaveBeenCalled();
  });

  it("should return the current value when initialization is requested", () => {
    const subject = new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    subject.next("test");
    (BrowserApi.messageListener as jest.Mock).mock.calls[1][1](
      {
        command: subject["requestInitMessageName"],
      },
      null,
      (response: string) => {
        expect(response).toBe("test");
      }
    );
  });

  it("should return undefined if initialization is requested before the value is set", () => {
    const subject = new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    (BrowserApi.messageListener as jest.Mock).mock.calls[1][1](
      {
        command: subject["requestInitMessageName"],
      },
      null,
      (response: string) => {
        expect(response).toBeUndefined();
      }
    );
  });

  it("should send a message when next is called", () => {
    const subject = new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    subject.next("test");
    expect(BrowserApi.sendMessage).toHaveBeenCalled();
  });

  it("should call super.next when next is called", () => {
    const subject = new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    const spy = jest.spyOn(BitSubject.prototype, "next");
    subject.next("test");

    expect(spy).toHaveBeenCalled();
  });

  it("should send a message to the foreground when next is called", () => {
    const subject = new BackgroundBitSubject<string>("serviceObservableName", (json) => json);
    subject.next("test");
    expect(BrowserApi.sendMessage).toHaveBeenCalled();
  });
});
