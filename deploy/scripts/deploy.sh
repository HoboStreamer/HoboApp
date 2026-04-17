#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# HoboApp — Deploy Script
# Pulls latest from GitHub, notifies HoboStreamer chat if available, and restarts the service.
#
# Usage (from the server):
#   sudo /opt/hobo/deploy/scripts/deploy.sh
#
# Or remotely:
#   ssh hobo-ovh "sudo /opt/hobo/deploy/scripts/deploy.sh"
# ═══════════════════════════════════════
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/hobo}"
SERVICE="${SERVICE:-hobo-tools}"
SITE_URL="${SITE_URL:-https://hobo.tools}"
API_URL="${API_URL:-http://127.0.0.1:3100}"
HOBOSTREAMER_API_URL="${HOBOSTREAMER_API_URL:-http://127.0.0.1:3000}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
UPDATES_PATH="${UPDATES_PATH:-/updates}"
BROADCAST_ENDPOINT="${BROADCAST_ENDPOINT:-/api/admin/broadcast}"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-15}"

cd "$REPO_DIR"

echo "╔══════════════════════════════════════╗"
echo "║      🏕️  HoboApp Deploy Script       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Record current commit before pull
OLD_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
echo "[Deploy] Current commit: ${OLD_HASH:0:8}"

# 2. Pull latest from GitHub
echo "[Deploy] Pulling from ${GIT_REMOTE} ${GIT_BRANCH}..."
git pull "$GIT_REMOTE" "$GIT_BRANCH" --ff-only
NEW_HASH=$(git rev-parse HEAD)
echo "[Deploy] New commit: ${NEW_HASH:0:8}"

# 3. Check if there are actually new commits
if [ "$OLD_HASH" = "$NEW_HASH" ]; then
    echo "[Deploy] Already up to date — no new commits."
    echo "[Deploy] Restarting service anyway..."
    sudo systemctl restart "$SERVICE"
    echo "[Deploy] Done. ✅"
    exit 0
fi

# 4. Get commit log between old and new
COMMIT_LOG=$(git --no-pager log --oneline "${OLD_HASH}..${NEW_HASH}" 2>/dev/null || echo "Update deployed")
COMMIT_COUNT=$(echo "$COMMIT_LOG" | wc -l | tr -d ' ')
echo "[Deploy] ${COMMIT_COUNT} new commit(s):"
echo "$COMMIT_LOG"
echo ""

# 5. Build a summary for the chat notification (first 3 lines max)
SUMMARY_LINES=$(echo "$COMMIT_LOG" | head -3)
if [ "$COMMIT_COUNT" -gt 3 ]; then
    SUMMARY="${SUMMARY_LINES}
...and $((COMMIT_COUNT - 3)) more"
else
    SUMMARY="$SUMMARY_LINES"
fi

# Single-line summary for the chat message
FIRST_LINE=$(echo "$COMMIT_LOG" | head -1 | sed 's/^[a-f0-9]* //')
if [ "$COMMIT_COUNT" -eq 1 ]; then
    CHAT_SUMMARY="Update: ${FIRST_LINE}"
else
    CHAT_SUMMARY="${COMMIT_COUNT} updates deployed — ${FIRST_LINE}"
fi

# 6. Send update notification to HoboStreamer chat if available (before restart)
echo "[Deploy] Looking for HoboStreamer chat..."
UPDATES_URL="${SITE_URL}${UPDATES_PATH}"
HOBOSTREAMER_HEALTH_URL="${HOBOSTREAMER_API_URL}${HEALTH_PATH}"
HOBOSTREAMER_BROADCAST_URL="${HOBOSTREAMER_API_URL}${BROADCAST_ENDPOINT}"

if curl -sf "${HOBOSTREAMER_HEALTH_URL}" > /dev/null 2>&1; then
    curl -sf -X POST "${HOBOSTREAMER_BROADCAST_URL}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ADMIN_TOKEN:-}" \
        -d "{
            \"type\": \"update\",
            \"summary\": $(echo "$CHAT_SUMMARY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
            \"url\": \"${UPDATES_URL}\"
        }" 2>/dev/null && echo "[Deploy] HoboStreamer chat notified ✅" || echo "[Deploy] HoboStreamer broadcast skipped (no admin token or service auth)"
else
    echo "[Deploy] HoboStreamer not available, skipping chat notification."
fi

# 7. Restart the service (this triggers graceful shutdown)
echo "[Deploy] Restarting ${SERVICE}..."
sudo systemctl restart "$SERVICE"

# 8. Wait for service to come back up
echo -n "[Deploy] Waiting for server..."
for i in $(seq 1 "${DEPLOY_TIMEOUT}"); do
    sleep 1
    if curl -sf "${API_URL}${HEALTH_PATH}" > /dev/null 2>&1; then
        echo " up! ✅"
        break
    fi
    echo -n "."
done

echo ""
echo "[Deploy] Deployment complete! 🎉"
echo "[Deploy] ${COMMIT_COUNT} commit(s) deployed: ${OLD_HASH:0:8} → ${NEW_HASH:0:8}"
