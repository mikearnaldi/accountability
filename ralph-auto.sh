#!/bin/bash

# Ralph Auto Loop - Autonomous AI coding agent that implements specs
#
# This script automatically implements everything in the specs/ directory:
# 1. Read all actionable specs from specs/ folder
# 2. Read context from context/ folder for best practices
# 3. Select a high priority task from the specs
# 4. Implement it
# 5. Update the spec (mark issues resolved, etc.)
# 6. Repeat until all specs are fully implemented
#
# Usage: ./ralph-auto.sh [options]
#
# Options:
#   --e2e    Run E2E tests as part of CI checks (slower but more thorough)
#
# The loop continues until Claude outputs "NOTHING_LEFT_TO_DO"
# COMMITS ARE HANDLED BY THIS SCRIPT, NOT THE AGENT.

set -e
set -o pipefail  # Propagate exit status through pipelines (important for tee)

# Parse arguments
RUN_E2E=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --e2e)
            RUN_E2E=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Configuration
PROGRESS_FILE="progress-auto.txt"
COMPLETE_MARKER="NOTHING_LEFT_TO_DO"
OUTPUT_DIR=".ralph-auto"
AGENT_CMD="claude --dangerously-skip-permissions --verbose --model opus"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup function - removes output directory on exit
cleanup() {
    if [ -d "$OUTPUT_DIR" ]; then
        rm -rf "$OUTPUT_DIR"
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Cleaned up $OUTPUT_DIR"
    fi
}

# Set trap to clean up on exit (normal exit, errors, or signals)
trap cleanup EXIT

# Create output directory for logs
mkdir -p "$OUTPUT_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "INFO")  echo -e "${BLUE}[$timestamp]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[$timestamp]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[$timestamp]${NC} $message" ;;
        "ERROR") echo -e "${RED}[$timestamp]${NC} $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$OUTPUT_DIR/ralph-auto.log"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    if ! command -v claude &> /dev/null; then
        log "ERROR" "Claude Code is not installed or not in PATH"
        exit 1
    fi

    # Check if we're in a git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log "ERROR" "Not in a git repository"
        exit 1
    fi

    # Check for specs directory with at least one .md file
    if [ ! -d "specs" ]; then
        log "ERROR" "specs/ directory not found"
        exit 1
    fi

    local spec_count=$(find specs -name "*.md" -type f | wc -l | tr -d ' ')
    if [ "$spec_count" -eq 0 ]; then
        log "ERROR" "No .md files found in specs/ directory"
        exit 1
    fi

    log "INFO" "Found $spec_count actionable spec(s) in specs/"

    # Check for context directory (optional but recommended)
    if [ ! -d "context" ]; then
        log "WARN" "context/ directory not found - context documentation unavailable"
    fi

    # Create progress file if it doesn't exist
    if [ ! -f "$PROGRESS_FILE" ]; then
        echo "# Ralph Auto Progress Log" > "$PROGRESS_FILE"
        echo "# This file tracks autonomous task completions" >> "$PROGRESS_FILE"
        echo "" >> "$PROGRESS_FILE"
    fi

    log "SUCCESS" "Prerequisites check passed"
}

# Check if there are uncommitted changes
has_changes() {
    ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]
}

# Filter stream-json output to show only relevant content
stream_filter() {
    while IFS= read -r line; do
        # Extract assistant text messages
        if echo "$line" | jq -e '.type == "assistant"' > /dev/null 2>&1; then
            text=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
            if [ -n "$text" ]; then
                echo "$text"
            fi

            # Show tool calls with details
            tool_info=$(echo "$line" | jq -r '
                .message.content[]? | select(.type == "tool_use") |
                .name as $name |
                if $name == "Read" then
                    "> Read: \(.input.file_path // "?")"
                elif $name == "Write" then
                    "> Write: \(.input.file_path // "?")"
                elif $name == "Edit" then
                    "> Edit: \(.input.file_path // "?")"
                elif $name == "Glob" then
                    "> Glob: \(.input.pattern // "?")"
                elif $name == "Grep" then
                    "> Grep: \(.input.pattern // "?") in \(.input.path // ".")"
                elif $name == "Bash" then
                    "> Bash: \(.input.command // "?" | .[0:80])"
                elif $name == "Task" then
                    "> Task: \(.input.description // "?")"
                else
                    "> \($name): \(.input | tostring | .[0:60])"
                end
            ' 2>/dev/null)
            if [ -n "$tool_info" ]; then
                echo -e "${BLUE}$tool_info${NC}"
            fi
        fi

        # Show final result
        if echo "$line" | jq -e '.type == "result"' > /dev/null 2>&1; then
            result=$(echo "$line" | jq -r '.result // empty' 2>/dev/null)
            if [ -n "$result" ]; then
                echo ""
                echo "$result"
            fi
        fi
    done
}

# Run CI checks
run_ci_checks() {
    log "INFO" "Running CI checks..."

    local ci_failed=0
    local error_output=""

    echo "=========================================="
    echo "Running CI Checks"
    echo "=========================================="

    # Type checking
    echo ""
    echo "1. Type Checking..."
    echo "-------------------"
    local typecheck_output
    if typecheck_output=$(pnpm typecheck 2>&1); then
        echo -e "${GREEN}Type check passed${NC}"
    else
        echo -e "${RED}Type check failed${NC}"
        ci_failed=1
        error_output+="## Type Check Failed

Command: \`pnpm typecheck\`

\`\`\`
$typecheck_output
\`\`\`

"
    fi

    # Linting
    echo ""
    echo "2. Linting..."
    echo "-------------"
    local lint_output
    if lint_output=$(pnpm lint 2>&1); then
        echo -e "${GREEN}Lint passed${NC}"
    else
        echo -e "${RED}Lint failed${NC}"
        ci_failed=1
        error_output+="## Lint Failed

Command: \`pnpm lint\`

\`\`\`
$lint_output
\`\`\`

"
    fi

    # Building
    echo ""
    echo "3. Building..."
    echo "--------------"
    local build_output
    if build_output=$(pnpm build 2>&1); then
        echo -e "${GREEN}Build passed${NC}"
    else
        echo -e "${RED}Build failed${NC}"
        ci_failed=1
        error_output+="## Build Failed

Command: \`pnpm build\`

\`\`\`
$build_output
\`\`\`

"
    fi

    # Testing
    echo ""
    echo "4. Running Tests..."
    echo "-------------------"
    local test_output
    if test_output=$(CI=true pnpm test 2>&1); then
        echo -e "${GREEN}Tests passed${NC}"
    else
        echo -e "${RED}Tests failed${NC}"
        ci_failed=1
        error_output+="## Unit Tests Failed

Command: \`pnpm test\`

\`\`\`
$test_output
\`\`\`

"
    fi

    # E2E Testing (optional)
    if [ "$RUN_E2E" = true ]; then
        echo ""
        echo "5. Running E2E Tests..."
        echo "-----------------------"
        local e2e_output
        if e2e_output=$(pnpm test:e2e 2>&1); then
            echo -e "${GREEN}E2E tests passed${NC}"
        else
            echo -e "${RED}E2E tests failed${NC}"
            ci_failed=1
            error_output+="## E2E Tests Failed

Command: \`pnpm test:e2e\`

\`\`\`
$e2e_output
\`\`\`

"
        fi
    fi

    # Summary
    echo ""
    echo "=========================================="
    if [ $ci_failed -eq 0 ]; then
        echo -e "${GREEN}All CI checks passed!${NC}"
        log "SUCCESS" "CI checks passed"
        return 0
    else
        echo -e "${RED}CI checks failed!${NC}"
        log "ERROR" "CI checks failed"
        # Save detailed errors for feedback to next iteration
        cat > "$OUTPUT_DIR/ci_errors.txt" << EOF
# CI Check Failures

The previous iteration failed CI checks. You MUST fix these errors before continuing.

$error_output
EOF
        return 1
    fi
}

# Commit changes with auto-generated message
commit_changes() {
    local iteration="$1"
    local task_summary="$2"

    log "INFO" "Committing changes..."

    # Stage all changes
    git add -A

    # Check if there are changes to commit
    if git diff --cached --quiet; then
        log "WARN" "No changes to commit"
        return 0
    fi

    # Create commit message
    local commit_msg="feat(auto): $task_summary

Ralph-Auto-Iteration: $iteration

Automated commit by Ralph Auto loop."

    # Commit
    if git commit -m "$commit_msg"; then
        log "SUCCESS" "Committed: $task_summary"
        return 0
    else
        log "ERROR" "Commit failed"
        return 1
    fi
}

# Rollback uncommitted changes
rollback_changes() {
    log "WARN" "Rolling back uncommitted changes..."
    git checkout -- .
    git clean -fd
}

# Build the prompt for the agent
build_prompt() {
    local iteration=$1
    local ci_errors=""
    local progress_content=""

    if [ -f "$OUTPUT_DIR/ci_errors.txt" ]; then
        ci_errors=$(cat "$OUTPUT_DIR/ci_errors.txt")
    fi

    if [ -f "$PROGRESS_FILE" ]; then
        progress_content=$(cat "$PROGRESS_FILE")
    fi

    # Get list of specs and context files
    local specs_list=$(find specs -name "*.md" -type f | sort | while read f; do echo "- \`$f\`"; done)
    local context_list=""
    if [ -d "context" ]; then
        context_list=$(find context -name "*.md" -type f | sort | while read f; do echo "- \`$f\`"; done)
    fi

    cat << PROMPT_EOF
# Ralph Auto Loop - Autonomous Spec Implementation Agent

You are an autonomous coding agent that implements everything defined in the \`specs/\` directory. You are running in an autonomous loop that will continue until all specs are fully implemented.

## Your Mission

1. **Read ALL specs** from the \`specs/\` directory - these are ACTIONABLE specifications
2. **Read context** from the \`context/\` directory for best practices and conventions
3. **Select** a high priority task from the specs (Known Issues, incomplete features, etc.)
4. **Implement** the task fully
5. **Update the spec** - mark issues as resolved, update status
6. **Signal** completion with \`TASK_COMPLETE: <brief description of what you did>\`

## Critical Rules

1. **DO NOT COMMIT**: The Ralph Auto script handles all git commits. Just write code.
2. **KEEP CI GREEN**: Your code MUST pass all tests and type checks.
3. **ONE TASK PER ITERATION**: Pick one focused task, complete it, and signal completion.
4. **UPDATE SPECS**: When you complete a task, UPDATE the spec file to mark it resolved.
5. **SIGNAL COMPLETION**: When done with a task, output \`TASK_COMPLETE: <description>\` on its own line.
6. **SIGNAL DONE**: When ALL specs are fully implemented, output \`NOTHING_LEFT_TO_DO\` on its own line.

## Actionable Specs (specs/)

These files define work to be implemented:

$specs_list

## Context Documentation (context/)

These files provide best practices and conventions - read them for guidance:

$context_list

## Task Selection Priority

Look for tasks in this priority order:
1. **CI Errors**: Fix any errors from the previous iteration FIRST
2. **Known Issues**: Issues marked "Open" or "CRITICAL" in spec files
3. **Missing Features**: Features defined in specs but not implemented
4. **Incomplete Pages**: Pages missing required elements per spec
5. **Layout Issues**: AppLayout, Breadcrumbs, Header, Sidebar issues
6. **Polish**: Small improvements to match the spec exactly

## Workflow

1. **Read ALL files in \`specs/\`** - understand what needs to be implemented
2. **Read relevant files in \`context/\`** - understand best practices
3. **Explore the codebase** to understand current state
4. **Compare** what exists vs what the specs require
5. **Pick** the highest priority gap you find
6. **Implement** it following the patterns from context/
7. **Update the spec** - mark issues as RESOLVED with details
8. **Test** - run \`pnpm typecheck\` to verify no type errors
9. **Signal** - output \`TASK_COMPLETE: <what you did>\`

## Signaling

When you have finished implementing a task:

\`\`\`
TASK_COMPLETE: Brief description of what you implemented
\`\`\`

When ALL specs are fully implemented (no more Known Issues, all features complete):

\`\`\`
NOTHING_LEFT_TO_DO
\`\`\`

## Project Context

- **Monorepo Structure**: packages/core, packages/persistence, packages/api, packages/web
- **Frontend**: React + TanStack Start + Tailwind CSS
- **Specs folder**: Contains ACTIONABLE specifications to implement
- **Context folder**: Contains best practices, conventions, patterns
- **NO Effect in frontend** - use openapi-fetch client, loaders, useState

## Important Reminders

- Read CLAUDE.md for project structure and conventions
- Read \`context/REACT_BEST_PRACTICES.md\` for React patterns
- Read \`context/USABILITY_BEST_PRACTICES.md\` for UX patterns
- All pages must use AppLayout with Sidebar and Header
- Use the Breadcrumbs component - never write manual breadcrumb HTML
- Every list page needs an empty state with CTA
- **UPDATE SPECS AS YOU WORK**: Keep specs in sync with implementation
- DO NOT run git commands - the script handles commits

PROMPT_EOF

    echo ""
    echo "## Iteration"
    echo ""
    echo "This is iteration $iteration of the autonomous loop."
    echo ""

    if [ -n "$ci_errors" ]; then
        echo "## Previous Iteration Errors"
        echo ""
        echo "$ci_errors"
        echo ""
    fi

    if [ -n "$progress_content" ]; then
        echo "## Progress So Far"
        echo ""
        echo '```'
        echo "$progress_content"
        echo '```'
        echo ""
    fi

    echo "## Begin"
    echo ""
    echo "Investigate the project, select a high priority task, implement it, and signal completion."
}

# Extract task description from output (handles stream-json format)
extract_task_description() {
    local output_file="$1"
    local desc=""

    # The output file is in stream-json format (one JSON object per line)
    # Extract text content from assistant messages and find TASK_COMPLETE:
    desc=$(cat "$output_file" | \
        jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null | \
        grep "TASK_COMPLETE:" | \
        head -1 | \
        sed 's/.*TASK_COMPLETE:[[:space:]]*//')

    # If we got something, return it; otherwise return default
    if [ -n "$desc" ]; then
        echo "$desc"
    else
        echo "Autonomous improvements"
    fi
}

# Run a single iteration of the agent
run_iteration() {
    local iteration=$1
    local output_file="$OUTPUT_DIR/iteration_${iteration}_output.txt"

    log "INFO" "Starting iteration $iteration"

    # Build the prompt
    local prompt=$(build_prompt "$iteration")

    # Save prompt for debugging
    local prompt_file="$OUTPUT_DIR/iteration_${iteration}_prompt.md"
    echo "$prompt" > "$prompt_file"

    # Run the agent
    log "INFO" "Running Claude Code agent..."
    echo ""  # Blank line before agent output

    # Use stream-json for real-time output, filter for readability
    if cat "$prompt_file" | $AGENT_CMD --print --output-format stream-json 2>&1 | tee "$output_file" | stream_filter; then
        echo ""  # Blank line after agent output
        log "SUCCESS" "Agent completed iteration $iteration"
    else
        echo ""
        log "WARN" "Agent exited with non-zero status"
    fi

    # Check if agent signaled nothing left to do
    if grep -q "$COMPLETE_MARKER" "$output_file"; then
        log "SUCCESS" "Agent signaled NOTHING_LEFT_TO_DO"
        return 0
    fi

    # Check if agent signaled task completion
    if grep -q "TASK_COMPLETE" "$output_file"; then
        log "INFO" "Agent signaled task completion"

        local task_desc=$(extract_task_description "$output_file")

        # Run CI checks before committing
        if run_ci_checks; then
            # Update progress log BEFORE committing so it's included
            echo "" >> "$PROGRESS_FILE"
            echo "## Iteration $iteration - $(date '+%Y-%m-%d %H:%M')" >> "$PROGRESS_FILE"
            echo "**Task**: $task_desc" >> "$PROGRESS_FILE"
            echo "**Status**: complete" >> "$PROGRESS_FILE"
            echo "---" >> "$PROGRESS_FILE"

            # Clear CI errors on success
            rm -f "$OUTPUT_DIR/ci_errors.txt"

            # Commit the changes
            if commit_changes "$iteration" "$task_desc"; then
                log "SUCCESS" "Task completed and committed: $task_desc"
            else
                log "ERROR" "Failed to commit changes"
                rollback_changes
                return 1
            fi
        else
            log "WARN" "CI checks failed - keeping changes for next iteration to fix"
            # Don't rollback - keep changes so next iteration can fix CI errors
        fi
    else
        log "WARN" "Agent did not complete a task"
        # Check if there are changes anyway
        if has_changes; then
            log "INFO" "Found uncommitted changes, running CI checks..."
            if run_ci_checks; then
                echo "" >> "$PROGRESS_FILE"
                echo "## Iteration $iteration - $(date '+%Y-%m-%d %H:%M')" >> "$PROGRESS_FILE"
                echo "**Task**: Partial work (no explicit completion signal)" >> "$PROGRESS_FILE"
                echo "---" >> "$PROGRESS_FILE"

                rm -f "$OUTPUT_DIR/ci_errors.txt"

                if commit_changes "$iteration" "Partial work from iteration $iteration"; then
                    log "SUCCESS" "Partial work committed"
                fi
            fi
        fi
    fi

    return 1
}

# Main loop
main() {
    log "INFO" "=========================================="
    log "INFO" "Starting Ralph Auto Loop"
    log "INFO" "=========================================="

    check_prerequisites

    local start_time=$(date +%s)
    local iteration=1
    local completed=false

    while true; do
        log "INFO" "------------------------------------------"
        log "INFO" "ITERATION $iteration"
        log "INFO" "------------------------------------------"

        # Run the agent
        if run_iteration $iteration; then
            log "SUCCESS" "Nothing left to do!"
            completed=true
            break
        fi

        # Small delay between iterations
        sleep 2

        ((iteration++))
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log "INFO" "=========================================="
    log "INFO" "Ralph Auto Loop Complete"
    log "INFO" "Total iterations: $iteration"
    log "INFO" "Duration: ${duration}s"

    if [ "$completed" = true ]; then
        log "SUCCESS" "All work completed successfully!"
    fi
    log "INFO" "=========================================="

    # Show git log of Ralph Auto commits
    log "INFO" "Recent Ralph Auto commits:"
    git log --oneline -10 --grep="Ralph-Auto" || true

    exit 0
}

# Run main
main
