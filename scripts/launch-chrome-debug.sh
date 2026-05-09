#!/usr/bin/env bash
# Launches your real Chrome with the DevTools Protocol on port 9222 so
# chrome-devtools-mcp can attach. Uses your main Chrome user-data-dir,
# meaning your existing Google + Suno login carries over.
#
# IMPORTANT: Chrome will REFUSE to launch if another Chrome process is
# already using the same profile. You must fully quit Chrome (Cmd+Q on the
# Chrome menu — closing windows is not enough) before running this.
#
# SECURITY: While this is running, anything on localhost can attach to
# your browser via port 9222 — including all your logged-in sessions.
# Quit this Chrome when you're done with the automation task.

set -euo pipefail

PORT="${CHROME_DEBUG_PORT:-9222}"
# Dedicated profile dir so DevTools port binds reliably. The user's MAIN profile
# silently blocked --remote-debugging-port (extension or policy interference) —
# the fresh profile sidesteps that. Suno login persists in this profile across
# runs once the user has signed in once via email magic link.
PROFILE_PARENT="${CHROME_USER_DATA_DIR:-$HOME/.chrome-debug-profile}"
PROFILE_NAME="${CHROME_PROFILE_NAME:-Default}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Chrome debug port $PORT is already in use. Reusing existing instance."
  exit 0
fi

if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  echo "ERROR: Chrome is already running. Quit it fully (Chrome menu > Quit, or Cmd+Q)"
  echo "       and re-run this script. Chrome cannot share a profile across instances."
  exit 1
fi

if [[ ! -d "$PROFILE_PARENT/$PROFILE_NAME" ]]; then
  echo "ERROR: Profile directory not found: $PROFILE_PARENT/$PROFILE_NAME"
  echo "       Override with CHROME_PROFILE_NAME=<name> if you use a non-Default profile."
  exit 1
fi

# Clean up stale singleton lock files left behind by a previous abrupt close.
# These can silently prevent Chrome from honoring --remote-debugging-port.
rm -f "$PROFILE_PARENT/SingletonLock" "$PROFILE_PARENT/SingletonSocket" "$PROFILE_PARENT/SingletonCookie"

echo "Launching Chrome on port $PORT (profile: $PROFILE_PARENT/$PROFILE_NAME)"

# Use `open -na` instead of invoking the binary directly so macOS Launch Services
# spawns a fresh Chrome instance and forwards our flags reliably. Direct binary
# invocation gets silently routed back to an existing/stale instance, which
# drops --remote-debugging-port and causes the port to never bind.
open -na "Google Chrome" --args \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_PARENT" \
  --profile-directory="$PROFILE_NAME" \
  --no-first-run \
  --no-default-browser-check \
  "https://suno.com/create"

echo "Chrome launched with your main profile. Waiting for DevTools port..."

# Poll until the DevTools endpoint responds, up to 20 seconds.
for i in $(seq 1 10); do
  if curl -s -m 2 "http://localhost:$PORT/json/version" > /dev/null 2>&1; then
    echo "DevTools port $PORT is responding."
    exit 0
  fi
  sleep 2
done

echo "WARNING: DevTools port $PORT did not respond within 20s. Chrome may have"
echo "         routed the launch back to an existing instance. Try:"
echo "         pkill -9 'Google Chrome'  # then re-run this script"
exit 1
