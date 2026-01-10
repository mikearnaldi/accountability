#!/bin/bash

# Ralph Loop - Long-running AI coding agent orchestrator
# Based on the Ralph Wiggum approach for autonomous coding agents
#
# Usage: ./ralph.sh [max_iterations]
#
# This script runs Claude Code in a loop, having it work through
# a PRD of user stories until all are complete or max iterations reached.
#
# COMMITS ARE HANDLED BY THIS SCRIPT, NOT THE AGENT.
# Each completed story = one atomic commit for easy rollback.

set -e

# Configuration
MAX_ITERATIONS=${1:-10}
PRD_FILE="prd.json"
PROGRESS_FILE="progress.txt"
PROMPT_FILE="RALPH_PROMPT.md"
COMPLETE_MARKER="<promise>COMPLETE</promise>"
OUTPUT_DIR=".ralph"
AGENT_CMD="claude --dangerously-skip-permissions --verbose"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

    echo "[$timestamp] [$level] $message" >> "$OUTPUT_DIR/ralph.log"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    if ! command -v $AGENT_CMD &> /dev/null; then
        log "ERROR" "Claude Code ($AGENT_CMD) is not installed or not in PATH"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log "ERROR" "jq is not installed"
        exit 1
    fi

    if [ ! -f "$PRD_FILE" ]; then
        log "ERROR" "PRD file not found: $PRD_FILE"
        exit 1
    fi

    if [ ! -f "$PROMPT_FILE" ]; then
        log "ERROR" "Prompt file not found: $PROMPT_FILE"
        exit 1
    fi

    # Check if we're in a git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log "ERROR" "Not in a git repository"
        exit 1
    fi

    # Create progress file if it doesn't exist
    if [ ! -f "$PROGRESS_FILE" ]; then
        echo "# Progress Log" > "$PROGRESS_FILE"
        echo "# This file tracks progress across Ralph loop iterations" >> "$PROGRESS_FILE"
        echo "" >> "$PROGRESS_FILE"
    fi

    log "SUCCESS" "Prerequisites check passed"
}

# Get the current story being worked on (highest priority pending or in_progress)
get_current_story() {
    # First check for in_progress, then pending
    local story=$(jq -r '[.stories[] | select(.status == "in_progress")] | sort_by(.priority) | .[0] // empty' "$PRD_FILE")

    if [ -z "$story" ]; then
        story=$(jq -r '[.stories[] | select(.status == "pending")] | sort_by(.priority) | .[0] // empty' "$PRD_FILE")
    fi

    echo "$story"
}

# Get story ID from story JSON
get_story_id() {
    echo "$1" | jq -r '.id'
}

# Get story title from story JSON
get_story_title() {
    echo "$1" | jq -r '.title'
}

# Get story phase from story JSON
get_story_phase() {
    echo "$1" | jq -r '.phase'
}

# Count incomplete stories in PRD
count_incomplete_stories() {
    jq '[.stories[] | select(.status != "complete")] | length' "$PRD_FILE"
}

# Get summary of PRD status
get_prd_status() {
    local total=$(jq '.stories | length' "$PRD_FILE")
    local complete=$(jq '[.stories[] | select(.status == "complete")] | length' "$PRD_FILE")
    local in_progress=$(jq '[.stories[] | select(.status == "in_progress")] | length' "$PRD_FILE")
    local pending=$(jq '[.stories[] | select(.status == "pending")] | length' "$PRD_FILE")

    echo "Total: $total | Complete: $complete | In Progress: $in_progress | Pending: $pending"
}

# Check if there are uncommitted changes
has_changes() {
    ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]
}

# Run CI checks
run_ci_checks() {
    log "INFO" "Running CI checks..."

    # Type check
    if ! pnpm typecheck 2>&1 | tee -a "$OUTPUT_DIR/ci.log"; then
        log "ERROR" "Type check failed"
        return 1
    fi

    # Tests (CI=true makes vitest run once and exit)
    if ! CI=true pnpm test 2>&1 | tee -a "$OUTPUT_DIR/ci.log"; then
        log "ERROR" "Tests failed"
        return 1
    fi

    log "SUCCESS" "CI checks passed"
    return 0
}

# Commit changes for a story
commit_story() {
    local story_id="$1"
    local story_title="$2"
    local story_phase="$3"
    local iteration="$4"

    log "INFO" "Committing changes for story $story_id..."

    # Stage all changes
    git add -A

    # Check if there are changes to commit
    if git diff --cached --quiet; then
        log "WARN" "No changes to commit"
        return 0
    fi

    # Create commit message
    local commit_msg="feat($story_phase): $story_title

Story: $story_id
Ralph-Iteration: $iteration

Automated commit by Ralph loop.
To rollback this story: git revert HEAD"

    # Commit
    if git commit -m "$commit_msg"; then
        log "SUCCESS" "Committed: $story_id - $story_title"
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

# Update story status in PRD
update_story_status() {
    local story_id="$1"
    local new_status="$2"

    jq --arg id "$story_id" --arg status "$new_status" \
        '(.stories[] | select(.id == $id)).status = $status' \
        "$PRD_FILE" > "${PRD_FILE}.tmp" && mv "${PRD_FILE}.tmp" "$PRD_FILE"
}

# Build the prompt for the agent
build_prompt() {
    local iteration=$1
    local story=$2

    # Extract only what's needed from PRD
    local technology=$(jq '.technology' "$PRD_FILE")
    local reference_repos=$(jq '.reference_repos' "$PRD_FILE")
    local progress_content=$(cat "$PROGRESS_FILE")
    local prompt_template=$(cat "$PROMPT_FILE")

    # Replace placeholders in template
    local prompt="$prompt_template"
    prompt="${prompt//\{\{ITERATION\}\}/$iteration}"
    prompt="${prompt//\{\{MAX_ITERATIONS\}\}/$MAX_ITERATIONS}"
    prompt="${prompt//\{\{CURRENT_STORY\}\}/$story}"
    prompt="${prompt//\{\{TECHNOLOGY\}\}/$technology}"
    prompt="${prompt//\{\{REFERENCE_REPOS\}\}/$reference_repos}"
    prompt="${prompt//\{\{PROGRESS_CONTENT\}\}/$progress_content}"

    echo "$prompt"
}

# Run a single iteration of the agent
run_iteration() {
    local iteration=$1
    local output_file="$OUTPUT_DIR/iteration_${iteration}_output.txt"

    # Get current story
    local story=$(get_current_story)
    if [ -z "$story" ] || [ "$story" = "null" ]; then
        log "SUCCESS" "No more stories to process"
        return 0
    fi

    local story_id=$(get_story_id "$story")
    local story_title=$(get_story_title "$story")
    local story_phase=$(get_story_phase "$story")

    log "INFO" "Starting iteration $iteration of $MAX_ITERATIONS"
    log "INFO" "Story: $story_id - $story_title"
    log "INFO" "PRD Status: $(get_prd_status)"

    # Mark story as in_progress
    update_story_status "$story_id" "in_progress"

    # Build the prompt with current story
    local prompt=$(build_prompt "$iteration" "$story")

    # Save prompt for debugging
    local prompt_file="$OUTPUT_DIR/iteration_${iteration}_prompt.md"
    echo "$prompt" > "$prompt_file"

    # Run the agent
    log "INFO" "Running Claude Code agent..."
    echo ""  # Blank line before agent output

    # Use stream-json for real-time output, filter for readability
    if cat "$prompt_file" | $AGENT_CMD --print --output-format stream-json 2>&1 | tee "$output_file" | ./scripts/stream-filter.sh; then
        echo ""  # Blank line after agent output
        log "SUCCESS" "Agent completed iteration $iteration"
    else
        echo ""
        log "WARN" "Agent exited with non-zero status"
    fi

    # Check if agent signaled story completion
    if grep -q "STORY_COMPLETE" "$output_file"; then
        log "INFO" "Agent signaled story completion"

        # Run CI checks before committing
        if run_ci_checks; then
            # Update prd.json and progress log BEFORE committing so they're included
            update_story_status "$story_id" "complete"

            echo "" >> "$PROGRESS_FILE"
            echo "## Iteration $iteration - $(date '+%Y-%m-%d %H:%M')" >> "$PROGRESS_FILE"
            echo "**Story**: $story_id - $story_title" >> "$PROGRESS_FILE"
            echo "**Status**: complete" >> "$PROGRESS_FILE"
            echo "---" >> "$PROGRESS_FILE"

            # Commit the changes (includes code, prd.json, and progress.txt)
            if commit_story "$story_id" "$story_title" "$story_phase" "$iteration"; then
                log "SUCCESS" "Story $story_id completed and committed"
            else
                log "ERROR" "Failed to commit story $story_id"
                rollback_changes
                update_story_status "$story_id" "pending"
                return 1
            fi
        else
            log "ERROR" "CI checks failed for story $story_id"
            rollback_changes
            update_story_status "$story_id" "pending"
            return 1
        fi
    else
        log "WARN" "Agent did not complete the story"
        # Keep status as in_progress for next iteration to continue
    fi

    # Check if all stories complete
    if grep -q "$COMPLETE_MARKER" "$output_file"; then
        log "SUCCESS" "Agent signaled ALL COMPLETE"
        return 0
    fi

    return 1
}

# Main loop
main() {
    log "INFO" "=========================================="
    log "INFO" "Starting Ralph Loop"
    log "INFO" "Max iterations: $MAX_ITERATIONS"
    log "INFO" "PRD file: $PRD_FILE"
    log "INFO" "=========================================="

    check_prerequisites

    local start_time=$(date +%s)
    local iteration=1
    local completed=false

    while [ $iteration -le $MAX_ITERATIONS ]; do
        log "INFO" "------------------------------------------"
        log "INFO" "ITERATION $iteration / $MAX_ITERATIONS"
        log "INFO" "------------------------------------------"

        # Check if all stories are complete before running
        local incomplete=$(count_incomplete_stories)
        if [ "$incomplete" -eq 0 ]; then
            log "SUCCESS" "All PRD stories are complete!"
            completed=true
            break
        fi

        # Run the agent
        if run_iteration $iteration; then
            # Check again if all complete
            incomplete=$(count_incomplete_stories)
            if [ "$incomplete" -eq 0 ]; then
                log "SUCCESS" "All PRD stories are complete!"
                completed=true
                break
            fi
        fi

        # Small delay between iterations
        sleep 2

        ((iteration++))
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log "INFO" "=========================================="
    log "INFO" "Ralph Loop Complete"
    log "INFO" "Total iterations: $((iteration))"
    log "INFO" "Duration: ${duration}s"
    log "INFO" "Final PRD Status: $(get_prd_status)"

    if [ "$completed" = true ]; then
        log "SUCCESS" "All work completed successfully!"
    else
        log "WARN" "Max iterations reached. Some work may remain."
    fi
    log "INFO" "=========================================="

    # Show git log of Ralph commits
    log "INFO" "Recent Ralph commits:"
    git log --oneline -10 --grep="Ralph-Iteration" || true

    # Return appropriate exit code
    if [ "$completed" = true ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main
main
