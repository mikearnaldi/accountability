#!/bin/bash

# CI Check - Run all CI checks (types, tests, lint)
# Usage: ./scripts/ci-check.sh
#
# This script runs all checks that must pass before committing.
# Used by Ralph loop to ensure code quality.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Running CI Checks"
echo "=========================================="

FAILED=0

# Type checking
echo ""
echo "1. Type Checking..."
echo "-------------------"
if pnpm typecheck 2>&1; then
    echo -e "${GREEN}Type check passed${NC}"
else
    echo -e "${RED}Type check failed${NC}"
    FAILED=1
fi

# Linting
echo ""
echo "2. Linting..."
echo "-------------"
if pnpm lint 2>&1; then
    echo -e "${GREEN}Lint passed${NC}"
else
    echo -e "${YELLOW}Lint issues found (non-blocking)${NC}"
    # Lint is warning only, don't fail
fi

# Testing
echo ""
echo "3. Running Tests..."
echo "-------------------"
if pnpm test 2>&1; then
    echo -e "${GREEN}Tests passed${NC}"
else
    echo -e "${RED}Tests failed${NC}"
    FAILED=1
fi

# Summary
echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All CI checks passed!${NC}"
    exit 0
else
    echo -e "${RED}CI checks failed!${NC}"
    exit 1
fi
