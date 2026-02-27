const originalConsole = console;

declare let console: any;

export function interceptConsole(): {
  log: jest.Mock<any, any>;
  warn: jest.Mock<any, any>;
  error: jest.Mock<any, any>;
} {
  console = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return console;
}

export function restoreConsole() {
  console = originalConsole;
}
