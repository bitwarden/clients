import { exitAfterCommand } from "./exit-after-command";

describe("exitAfterCommand", () => {
  let exit: jest.SpyInstance;
  let stdoutWrite: jest.SpyInstance;
  let stderrWrite: jest.SpyInstance;

  beforeEach(() => {
    exit = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
    // Hold each flush callback, so the test decides when the stream has drained.
    stdoutWrite = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWrite = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const drain = (write: jest.SpyInstance) => write.mock.calls.at(-1)[1]();

  it("exits once stdout and stderr have flushed", () => {
    exitAfterCommand();

    expect(exit).not.toHaveBeenCalled();
    drain(stdoutWrite);
    expect(exit).not.toHaveBeenCalled();
    drain(stderrWrite);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("exits with the exit code the command set", () => {
    exitAfterCommand();
    drain(stdoutWrite);
    drain(stderrWrite);

    // process.exit() without an argument uses process.exitCode, which processResponse sets.
    expect(exit).toHaveBeenCalledWith();
  });
});
