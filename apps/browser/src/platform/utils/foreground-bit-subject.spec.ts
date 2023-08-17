import mock from "jest-mock-extended/lib/Mock";

import { BitSubject } from "@bitwarden/common/platform/misc/bit-subject";

import { BrowserApi } from "../browser/browser-api";

import { ForegroundBitSubject } from "./foreground-bit-subject";

jest.mock("../browser/browser-api", () => {
  return {
    BrowserApi: mock<BrowserApi>(),
  };
});

describe("ForegroundBitSubject", () => {
  let subject: ForegroundBitSubject<string>;

  beforeEach(() => {
    subject = new ForegroundBitSubject<string>("serviceObservableName", (json) => json);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("it should set up a message listener", () => {
    expect(BrowserApi.messageListener).toHaveBeenCalled(); // from beforeEach constructor
  });

  it("should send a message when next is called", () => {
    subject.next("test");
    expect(BrowserApi.sendMessage).toHaveBeenCalled();
  });

  it("should not emit when next is called", () => {
    const subjectSpy = jest.spyOn(subject["_subject"], "next");
    const superSpy = jest.spyOn(BitSubject.prototype, "next");
    subject.next("test");
    expect(subjectSpy).not.toHaveBeenCalled();
    expect(superSpy).not.toHaveBeenCalled();
  });

  it("should call super.next when a message is received from background", () => {
    const spy = jest.spyOn(BitSubject.prototype, "next");
    const thisNextSpy = jest.spyOn(subject, "next");
    (BrowserApi.messageListener as jest.Mock).mock.calls[0][1]({
      command: subject["fromBackgroundMessageName"],
      data: "test",
    });
    expect(spy).toHaveBeenCalled();
    expect(thisNextSpy).not.toHaveBeenCalled();
  });

  it("should initialize from background", () => {
    BrowserApi.sendMessage = jest.fn((message, data, callback) => {
      callback("expected");
    });
    subject.init("not expected").then((s) => {
      expect(s.value).toBe("expected");
    });
  });

  it("should initialize from background with fallback value", () => {
    BrowserApi.sendMessage = jest.fn((message, data, callback) => {
      callback(undefined);
    });
    subject.init("expected").then((s) => {
      expect(s.value).toBe("expected");
    });
  });
});
