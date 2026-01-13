#!/bin/bash
# Start server script for E2E tests
# DATABASE_URL can come from:
# 1. Environment variable (passed by Playwright webServer config)
# 2. .env.test file (written by globalSetup as backup)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.test"

echo "=== E2E Server Startup ==="
echo "CWD: $(pwd)"
echo "Script dir: ${SCRIPT_DIR}"
echo "Env file path: ${ENV_FILE}"
echo "DATABASE_URL from env: ${DATABASE_URL:-<not set>}"

# If DATABASE_URL is not set, try to read from .env.test file
if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL not in environment, checking file..."

  # Wait for env file to appear (globalSetup might still be writing it)
  MAX_WAIT=30
  WAIT_COUNT=0
  while [ ! -f "${ENV_FILE}" ] && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    echo "Waiting for env file... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done

  echo "ENV file exists: $(test -f "${ENV_FILE}" && echo yes || echo no)"

  # Source the environment file - use absolute path
  if [ -f "${ENV_FILE}" ]; then
    echo "ENV file contents:"
    cat "${ENV_FILE}"
    # Source the file directly to set the variable
    . "${ENV_FILE}"
    echo "DATABASE_URL after sourcing: ${DATABASE_URL}"
  else
    echo "ERROR: ENV file not found at ${ENV_FILE} after waiting ${MAX_WAIT}s"
    exit 1
  fi
else
  echo "DATABASE_URL found in environment"
fi

# Verify DATABASE_URL is set
if [ -z "${DATABASE_URL}" ]; then
  echo "ERROR: DATABASE_URL is empty"
  exit 1
fi

# Use TEST_PORT if set, otherwise default to 3333
PORT="${TEST_PORT:-3333}"

echo ""
echo "Starting E2E server with:"
echo "  DATABASE_URL: ${DATABASE_URL}"
echo "  NODE_ENV: production"
echo "  PORT: ${PORT}"
echo ""

# Build
pnpm build

echo ""
echo "Build complete, starting server on port ${PORT}..."
echo ""

# Run the server directly with node
# Export all required environment variables explicitly
export DATABASE_URL
export NODE_ENV=production
export PORT
exec node .output/server/index.mjs
