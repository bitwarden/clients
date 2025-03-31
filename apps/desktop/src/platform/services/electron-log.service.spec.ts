import { ElectronLogMainService } from "./electron-log.main.service";

// Mock the use of the electron API to avoid errors
jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
}));

describe("ElectronLogMainService", () => {
  it("sets dev based on electron method", () => {
    process.env.ELECTRON_IS_DEV = "1";
    const logService = new ElectronLogMainService();
    expect(logService).toEqual(expect.objectContaining({ isDev: true }) as any);
  });
});
