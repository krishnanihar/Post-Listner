#!/usr/bin/env bash
# Sync public/stems/ and public/music/ to a Cloudflare R2 bucket.
#
# Idempotent: aws s3 sync only uploads new/changed files based on size+mtime.
# Cache headers are set to immutable + 1-year max-age — these MP3s never
# change once uploaded, so browsers and Cloudflare's edge can cache them
# aggressively.
#
# Requires aws-cli installed (brew install awscli) and these env vars:
#   R2_ACCOUNT_ID         — 32-hex-char Cloudflare account ID
#   R2_ACCESS_KEY_ID      — from R2 → Manage API Tokens
#   R2_SECRET_ACCESS_KEY  — from R2 → Manage API Tokens (shown once on creation)
#   R2_BUCKET             — bucket name (e.g. postlistener-assets)
#
# Set these in .env.local (one per line, KEY=value), or export in your shell
# before running.
#
# Usage:
#   bash scripts/upload-to-r2.sh                # sync stems + music
#   bash scripts/upload-to-r2.sh stems          # sync stems only
#   bash scripts/upload-to-r2.sh music          # sync masters only
#   bash scripts/upload-to-r2.sh --dry-run      # show what would change

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

# ─── Load credentials from .env.local if present ─────────────────────────────
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID not set — add to .env.local or export}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID not set}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY not set}"
: "${R2_BUCKET:?R2_BUCKET not set}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws-cli not installed. Run: brew install awscli" >&2
  exit 1
fi

# ─── Configure aws-cli to talk to R2 instead of AWS S3 ───────────────────────
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Cache for 1 year, immutable — these files are content-addressed by path.
# If a stem ever needs replacement, change the path or invalidate via R2 dashboard.
CACHE_HEADER="public, max-age=31536000, immutable"

# ─── Argument parsing ────────────────────────────────────────────────────────
DRY_RUN=""
TARGETS=("stems" "music")
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dryrun" ;;
    stems)     TARGETS=("stems") ;;
    music)     TARGETS=("music") ;;
    *)         echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# ─── Sync function ───────────────────────────────────────────────────────────
sync_dir() {
  local local_dir="$1"
  local remote_prefix="$2"
  local content_type="$3"
  local src="${ROOT}/public/${local_dir}"

  if [[ ! -d "${src}" ]]; then
    echo "[SKIP] ${local_dir} (no such directory)"
    return
  fi

  local file_count
  file_count=$(find "${src}" -type f -name "*.mp3" | wc -l | tr -d ' ')
  echo "[SYNC] ${local_dir}/ → s3://${R2_BUCKET}/${remote_prefix}/  (${file_count} files)"

  aws s3 sync \
    "${src}" \
    "s3://${R2_BUCKET}/${remote_prefix}/" \
    --endpoint-url "${ENDPOINT}" \
    --cache-control "${CACHE_HEADER}" \
    --content-type "${content_type}" \
    --exclude "*.DS_Store" \
    ${DRY_RUN}
}

# ─── Run ─────────────────────────────────────────────────────────────────────
echo "Target endpoint: ${ENDPOINT}"
echo "Target bucket:   ${R2_BUCKET}"
[[ -n "${DRY_RUN}" ]] && echo "Mode: DRY RUN (no uploads)"
echo ""

for target in "${TARGETS[@]}"; do
  case "${target}" in
    stems) sync_dir "stems" "stems" "audio/mpeg" ;;
    music) sync_dir "music" "music" "audio/mpeg" ;;
  esac
  echo ""
done

echo "Done."
echo ""
echo "Next: set the runtime base URLs in Vercel env vars:"
echo "  VITE_STEMS_BASE_URL=https://<your-public-url>/stems"
echo "  VITE_MASTERS_BASE_URL=https://<your-public-url>/music"
