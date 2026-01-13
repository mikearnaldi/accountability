#!/bin/bash
# Start server script for E2E tests
# Reads DATABASE_URL from .env.test file created by global-setup

set -e

echo "=== E2E Server Startup ==="
echo "CWD: $(pwd)"
echo "ENV file exists: $(test -f test-e2e/.env.test && echo yes || echo no)"

# Source the environment file
if [ -f "test-e2e/.env.test" ]; then
  echo "ENV file contents:"
  cat test-e2e/.env.test
  export DATABASE_URL=$(grep DATABASE_URL test-e2e/.env.test | cut -d '"' -f 2)
fi

# Use TEST_PORT if set, otherwise default to 3333
export PORT="${TEST_PORT:-3333}"

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
NODE_ENV=production node .output/server/index.mjs
