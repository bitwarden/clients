export async function createTokenExtensionUrl(path: string): Promise<string> {
  const response = await chrome.runtime.sendMessage({
    command: "createTokenExtensionUrl",
    path: path,
  });

  if (response?.error) {
    throw new Error(response.error.message || "Failed to create token URL");
  }

  return response.result;
}

export async function validateExtensionUrl(url: string): Promise<boolean> {
  const response = await chrome.runtime.sendMessage({
    command: "validateExtensionUrl",
    url: url,
  });

  if (response?.error) {
    throw new Error(response.error.message || "Failed to validate URL");
  }

  return response.result;
}

export async function revokeExtensionUrlToken(url: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    command: "revokeExtensionUrlToken",
    url: url,
  });

  if (response?.error) {
    throw new Error(response.error.message || "Failed to revoke token");
  }
}
