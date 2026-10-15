#!/usr/bin/env bash

# Starts Storybook and blocks until it's serving, so the environment isn't ready until Storybook is
# (see `waitFor` in devcontainer.json). The design-prototyping plugin reuses this server and reads
# the log to diagnose build errors.

LOG_FILE=/tmp/storybook.log
URL=http://127.0.0.1:6006
TIMEOUT_SECONDS=900

if curl -s -o /dev/null "$URL"; then
    echo "Storybook already running on :6006"
    exit 0
fi

cd /workspace

# If the container restarted before on-create finished, dependencies are incomplete and the
# on-create command won't run again
if [ ! -x node_modules/.bin/ng ]; then
    echo "Dependencies are incomplete; finishing setup first"
    bash .devcontainer/design/on-create-command.sh || exit 1
fi

# setsid detaches Storybook from the lifecycle command's process group, which is killed on exit.
# Storybook binds to `localhost`, which is IPv6-only (::1) in this image; port forwarding connects
# over IPv4, so bind 127.0.0.1 explicitly.
setsid nohup npm run storybook -- --host=127.0.0.1 > "$LOG_FILE" 2>&1 < /dev/null &
STORYBOOK_PID=$!

echo "Starting Storybook (first build takes a few minutes); logs at $LOG_FILE"
for ((elapsed = 0; elapsed < TIMEOUT_SECONDS; elapsed += 5)); do
    if curl -s -o /dev/null "$URL"; then
        echo "Storybook is ready at $URL"
        exit 0
    fi
    if ! kill -0 "$STORYBOOK_PID" 2> /dev/null; then
        echo "Storybook exited before it was ready. Last log lines:"
        tail -20 "$LOG_FILE"
        exit 1
    fi
    sleep 5
done

echo "Storybook wasn't ready after ${TIMEOUT_SECONDS}s. Last log lines:"
tail -20 "$LOG_FILE"
exit 1
