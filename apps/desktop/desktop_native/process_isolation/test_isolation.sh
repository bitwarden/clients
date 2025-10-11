#!/bin/bash

# This script tests the memory isolation status of bitwarden-desktop processes. The script will print "isolated"
# if the memory is not accessible by other processes.

CURRENT_USER=$(whoami)

# Find processes with "bitwarden" in the command
pids=$(pgrep -f bitwarden)

if [[ -z "$pids" ]]; then
    echo "No bitwarden processes found."
    exit 0
fi

for pid in $pids; do
    # Get process info: command, PPID, RSS memory
    read cmd ppid rss <<<$(ps -o comm=,ppid=,rss= -p "$pid")

    # Explicitly skip if the command line does not contain "bitwarden"
    if ! grep -q "bitwarden" <<<"$cmd"; then
        continue
    fi

    # Check ownership of /proc/$pid/environ
    owner=$(stat -c "%U" /proc/$pid/environ 2>/dev/null)

    if [[ "$owner" == "root" ]]; then
        status="isolated"
    elif [[ "$owner" == "$CURRENT_USER" ]]; then
        status="insecure"
    else
        status="unknown-owner:$owner"
    fi

    # Convert memory to MB 
    mem_mb=$((rss / 1024))

    echo "PID: $pid | CMD: $cmd | Mem: ${mem_mb}MB | Owner: $owner | Status: $status"
done
