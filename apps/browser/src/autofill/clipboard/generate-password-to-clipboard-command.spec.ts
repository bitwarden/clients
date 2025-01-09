import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, Subscription } from "rxjs";

import { AutofillSettingsService } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserTaskSchedulerService } from "../../platform/services/abstractions/browser-task-scheduler.service";

import { ClearClipboard } from "./clear-clipboard";
import { GeneratePasswordToClipboardCommand } from "./generate-password-to-clipboard-command";

jest.mock("rxjs", () => {
  const actual = jest.requireActual("rxjs");
  return {
    ...actual,
    firstValueFrom: jest.fn(),
  };
});

describe("GeneratePasswordToClipboardCommand", () => {
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let autofillSettingsService: MockProxy<AutofillSettingsService>;
  let browserTaskSchedulerService: MockProxy<BrowserTaskSchedulerService>;

  let sut: GeneratePasswordToClipboardCommand;

  beforeEach(() => {
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    autofillSettingsService = mock<AutofillSettingsService>();
    browserTaskSchedulerService = mock<BrowserTaskSchedulerService>({
      setTimeout: jest.fn((taskName, timeoutInMs) => {
        const timeoutHandle = setTimeout(() => {
          if (taskName === ScheduledTaskNames.generatePasswordClearClipboardTimeout) {
            void ClearClipboard.run();
          }
        }, timeoutInMs);

        return new Subscription(() => clearTimeout(timeoutHandle));
      }),
    });

    passwordGenerationService.getOptions.mockResolvedValue([{ length: 8 }, {} as any]);

    passwordGenerationService.generatePassword.mockResolvedValue("PASSWORD");

    jest.spyOn(BrowserApi, "sendTabsMessage").mockReturnValue();

    sut = new GeneratePasswordToClipboardCommand(
      passwordGenerationService,
      autofillSettingsService,
      browserTaskSchedulerService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("generatePasswordToClipboard", () => {
    it("has clear clipboard value", async () => {
      jest.useFakeTimers();
      jest.spyOn(ClearClipboard, "run");
      (firstValueFrom as jest.Mock).mockResolvedValue(2 * 60); // 2 minutes

      await sut.generatePasswordToClipboard({ id: 1 } as any);
      jest.advanceTimersByTime(2 * 60 * 1000);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledTimes(1);
      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledWith(1, {
        command: "copyText",
        text: "PASSWORD",
      });
      expect(browserTaskSchedulerService.setTimeout).toHaveBeenCalledTimes(1);
      expect(browserTaskSchedulerService.setTimeout).toHaveBeenCalledWith(
        ScheduledTaskNames.generatePasswordClearClipboardTimeout,
        expect.any(Number),
      );
      expect(ClearClipboard.run).toHaveBeenCalledTimes(1);
    });

    it("does not have clear clipboard value", async () => {
      jest.spyOn(sut as any, "getClearClipboard").mockImplementation(() => null);

      await sut.generatePasswordToClipboard({ id: 1 } as any);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledTimes(1);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledWith(1, {
        command: "copyText",
        text: "PASSWORD",
      });
      expect(browserTaskSchedulerService.setTimeout).not.toHaveBeenCalled();
    });
  });
});
