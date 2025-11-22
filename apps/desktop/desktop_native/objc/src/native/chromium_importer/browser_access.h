#ifndef BROWSER_ACCESS_H
#define BROWSER_ACCESS_H

#include <stdbool.h>

// Request user permission to access browser directory
// Returns base64-encoded bookmark data, or NULL if declined
// Caller must free returned string
char* requestBrowserAccess(const char* browserName);

// Check if we have stored bookmark (doesn't verify validity)
bool hasStoredBrowserAccess(const char* browserName);

// Start accessing browser using stored bookmark
// Returns resolved path, or NULL if bookmark invalid
// Caller must free returned string and call stopBrowserAccess when done
char* startBrowserAccess(const char* browserName);

// Stop accessing browser (MUST be called after startBrowserAccess)
void stopBrowserAccess(const char* browserName);

#endif