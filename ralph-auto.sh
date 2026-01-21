#!/bin/bash

# Ralph Auto Loop - Autonomous AI coding agent that implements specs
#
# This script runs an autonomous agent to implement a specific task.
# A focus prompt is REQUIRED - the agent will only do what you ask.
#
# Usage: ./ralph-auto.sh <focus prompt> [options]
#
# Options:
#   --e2e                    Run E2E tests as part of CI checks (slower but more thorough)
#   --skip-checks            Skip all CI checks (typecheck, lint, build, tests)
#   --max-iterations <n>     Stop after n iterations (default: unlimited)
#
# Examples:
#   ./ralph-auto.sh "Fix the authentication bug in login flow"
#   ./ralph-auto.sh "Implement the exchange rate sync feature" --max-iterations 5
#   ./ralph-auto.sh "Add E2E tests for consolidated reports" --e2e
#   ./ralph-auto.sh "Quick experiment" --skip-checks
#
# The loop continues until the task is complete (TASK_COMPLETE signal)
# COMMITS ARE HANDLED BY THIS SCRIPT, NOT THE AGENT.

set -e
set -o pipefail  # Propagate exit status through pipelines (important for tee)

# Parse arguments
RUN_E2E=false
SKIP_CHECKS=false
FOCUS_PROMPT=""
MAX_ITERATIONS=0  # 0 means unlimited

while [[ $# -gt 0 ]]; do
    case $1 in
        --e2e)
            RUN_E2E=true
            shift
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            shift
            ;;
        --max-iterations)
            if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                MAX_ITERATIONS="$2"
                shift 2
            else
                echo "Error: --max-iterations requires a positive integer"
                exit 1
            fi
            ;;
        --help|-h)
            echo "Usage: ./ralph-auto.sh <focus prompt> [options]"
            echo ""
            echo "A focus prompt is REQUIRED. The agent will only do what you ask."
            echo ""
            echo "Options:"
            echo "  --e2e                    Run E2E tests as part of CI checks"
            echo "  --skip-checks            Skip all CI checks (typecheck, lint, build, tests)"
            echo "  --max-iterations <n>     Stop after n iterations (default: unlimited)"
            echo "  --help, -h               Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./ralph-auto.sh \"Fix the authentication bug\""
            echo "  ./ralph-auto.sh \"Implement exchange rate sync\" --max-iterations 5"
            echo "  ./ralph-auto.sh \"Add E2E tests\" --e2e"
            echo "  ./ralph-auto.sh \"Quick fix\" --skip-checks"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            # Positional argument - treat as focus prompt
            if [[ -z "$FOCUS_PROMPT" ]]; then
                FOCUS_PROMPT="$1"
            else
                echo "Error: Multiple focus prompts provided"
                exit 1
            fi
            shift
            ;;
    esac
done

# Focus prompt is required
if [[ -z "$FOCUS_PROMPT" ]]; then
    echo "Error: A focus prompt is required"
    echo ""
    echo "Usage: ./ralph-auto.sh <focus prompt> [options]"
    echo ""
    echo "Examples:"
    echo "  ./ralph-auto.sh \"Fix the authentication bug\""
    echo "  ./ralph-auto.sh \"Implement exchange rate sync\""
    echo ""
    echo "Use --help for more information"
    exit 1
fi

# Configuration
PROGRESS_FILE="progress-auto.txt"
PROMPT_TEMPLATE="RALPH_AUTO_PROMPT.md"
COMPLETE_MARKER="NOTHING_LEFT_TO_DO"
OUTPUT_DIR=".ralph-auto"
AGENT_CMD="claude --dangerously-skip-permissions --verbose --model opus"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track child processes for cleanup
CHILD_PIDS=""

# Cleanup function - kills children and removes output directory
cleanup() {
    # Kill any tracked child processes
    if [ -n "$CHILD_PIDS" ]; then
        for pid in $CHILD_PIDS; do
            if kill -0 "$pid" 2>/dev/null; then
                kill -TERM "$pid" 2>/dev/null || true
                sleep 0.5
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi
        done
    fi

    # Also kill any child processes of this script
    pkill -P $$ 2>/dev/null || true

    if [ -d "$OUTPUT_DIR" ]; then
        rm -rf "$OUTPUT_DIR"
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Cleaned up $OUTPUT_DIR"
    fi
}

# Signal handler for graceful shutdown
handle_signal() {
    echo ""
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Received interrupt signal, shutting down..."
    cleanup
    exit 130
}

# Set traps for cleanup on exit and signals
trap cleanup EXIT
trap handle_signal INT TERM

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

    # Check for prompt template
    if [ ! -f "$PROMPT_TEMPLATE" ]; then
        log "ERROR" "$PROMPT_TEMPLATE not found"
        exit 1
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
    local focus_section=""

    if [ -f "$OUTPUT_DIR/ci_errors.txt" ]; then
        ci_errors="## Previous Iteration Errors

**CI checks failed in the previous iteration. You MUST fix these errors.**

Read the error details from: \`$OUTPUT_DIR/ci_errors.txt\`
"
    fi

    if [ -f "$PROGRESS_FILE" ]; then
        progress_content="## Progress So Far

\`\`\`
$(cat "$PROGRESS_FILE")
\`\`\`
"
    fi

    # Build focus section if a focus prompt was provided
    if [ -n "$FOCUS_PROMPT" ]; then
        focus_section="## 🎯 FOCUS MODE (User-Specified)

**The user has specified that you should ONLY work on the following task:**

> $FOCUS_PROMPT

Work exclusively on this task. When the task is complete, signal TASK_COMPLETE. Do NOT select other tasks from specs - only do what is specified above.

"
    fi

    # Get list of specs files
    local specs_list=$(find specs -name "*.md" -type f | sort | while read f; do echo "- \`$f\`"; done)

    # Read template and substitute placeholders
    local prompt=$(cat "$PROMPT_TEMPLATE")
    prompt="${prompt//\{\{SPECS_LIST\}\}/$specs_list}"
    prompt="${prompt//\{\{ITERATION\}\}/$iteration}"
    prompt="${prompt//\{\{CI_ERRORS\}\}/$ci_errors}"
    prompt="${prompt//\{\{PROGRESS\}\}/$progress_content}"
    prompt="${prompt//\{\{FOCUS\}\}/$focus_section}"

    echo "$prompt"
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

    # Log prompt details
    local prompt_lines=$(echo "$prompt" | wc -l | tr -d ' ')
    local has_ci_errors="no"
    if [ -f "$OUTPUT_DIR/ci_errors.txt" ]; then
        has_ci_errors="yes"
    fi
    log "INFO" "Prompt: $prompt_lines lines, CI errors: $has_ci_errors"
    log "INFO" "Prompt file: $prompt_file"

    # Run the agent
    log "INFO" "Running Claude Code agent..."
    echo ""  # Blank line before agent output

    # Use stream-json for real-time output, filter for readability
    # Run synchronously - signal handler will kill child processes on Ctrl+C
    local agent_exit_code=0
    if cat "$prompt_file" | $AGENT_CMD --print --output-format stream-json 2>&1 | tee "$output_file" | stream_filter; then
        echo ""  # Blank line after agent output
        log "SUCCESS" "Agent completed iteration $iteration"
    else
        agent_exit_code=$?
        echo ""
        if [ $agent_exit_code -eq 130 ] || [ $agent_exit_code -eq 143 ]; then
            log "INFO" "Agent interrupted by user"
            return 1
        fi
        log "WARN" "Agent exited with non-zero status ($agent_exit_code)"
    fi

    # Extract only assistant text content from stream-json (excludes prompt)
    local assistant_text
    assistant_text=$(cat "$output_file" | \
        jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)

    # Check for signals
    local has_task_complete=false
    local has_nothing_left=false

    if echo "$assistant_text" | grep -q "TASK_COMPLETE"; then
        has_task_complete=true
    fi
    if echo "$assistant_text" | grep -q "$COMPLETE_MARKER"; then
        has_nothing_left=true
    fi

    # Handle TASK_COMPLETE first (commit the work)
    if [ "$has_task_complete" = true ]; then
        log "INFO" "Agent signaled task completion"

        local task_desc=$(extract_task_description "$output_file")

        # Run CI checks before committing (unless skipped)
        local ci_passed=true
        if [ "$SKIP_CHECKS" = true ]; then
            log "INFO" "Skipping CI checks (--skip-checks)"
        elif ! run_ci_checks; then
            ci_passed=false
        fi

        if [ "$ci_passed" = true ]; then
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
            return 1
        fi
    elif has_changes; then
        # No TASK_COMPLETE but there are changes - commit as partial work
        log "WARN" "Agent did not signal TASK_COMPLETE but has uncommitted changes"

        # Run CI checks (unless skipped)
        local ci_passed=true
        if [ "$SKIP_CHECKS" = true ]; then
            log "INFO" "Skipping CI checks (--skip-checks)"
        else
            log "INFO" "Found uncommitted changes, running CI checks..."
            if ! run_ci_checks; then
                ci_passed=false
            fi
        fi

        if [ "$ci_passed" = true ]; then
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

    # Now check if we should exit the loop
    # ONLY exit if NOTHING_LEFT_TO_DO AND no CI errors pending
    if [ "$has_nothing_left" = true ]; then
        if [ -f "$OUTPUT_DIR/ci_errors.txt" ]; then
            log "WARN" "Agent signaled NOTHING_LEFT_TO_DO but CI errors exist - continuing to fix errors"
            return 1
        else
            log "SUCCESS" "Agent signaled NOTHING_LEFT_TO_DO"
            return 0
        fi
    fi

    return 1
}

# Main loop
main() {
    log "INFO" "=========================================="
    log "INFO" "Starting Ralph Auto Loop"
    log "INFO" "=========================================="

    if [ -n "$FOCUS_PROMPT" ]; then
        log "INFO" "Focus: $FOCUS_PROMPT"
    fi
    if [ "$MAX_ITERATIONS" -gt 0 ]; then
        log "INFO" "Max iterations: $MAX_ITERATIONS"
    fi
    if [ "$SKIP_CHECKS" = true ]; then
        log "WARN" "Skip checks: enabled (no CI validation)"
    fi

    check_prerequisites

    local start_time=$(date +%s)
    local iteration=1
    local completed=false

    # Run initial CI checks before first iteration (unless skipped)
    # This ensures the agent knows about any pre-existing errors
    if [ "$SKIP_CHECKS" = true ]; then
        log "INFO" "Skipping initial CI checks (--skip-checks)"
        rm -f "$OUTPUT_DIR/ci_errors.txt"
    else
        log "INFO" "Running initial CI checks..."
        if ! run_ci_checks; then
            log "WARN" "Initial CI checks failed - errors will be included in prompt for agent to fix"
        else
            log "SUCCESS" "Initial CI checks passed - starting with clean slate"
            # Clear any stale error file
            rm -f "$OUTPUT_DIR/ci_errors.txt"
        fi
    fi

    while true; do
        log "INFO" "------------------------------------------"
        log "INFO" "ITERATION $iteration"
        if [ "$MAX_ITERATIONS" -gt 0 ]; then
            log "INFO" "(max: $MAX_ITERATIONS)"
        fi
        if [ -n "$FOCUS_PROMPT" ]; then
            log "INFO" "Focus: $FOCUS_PROMPT"
        fi
        log "INFO" "------------------------------------------"

        # Run the agent
        if run_iteration $iteration; then
            log "SUCCESS" "Nothing left to do!"
            completed=true
            break
        fi

        # Check max iterations
        if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$iteration" -ge "$MAX_ITERATIONS" ]; then
            log "WARN" "Reached max iterations ($MAX_ITERATIONS) - stopping"
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
