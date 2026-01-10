#!/bin/bash

# PRD Status - Show current status of all user stories
# Usage: ./scripts/prd-status.sh

PRD_FILE="${1:-prd.json}"

if [ ! -f "$PRD_FILE" ]; then
    echo "Error: PRD file not found: $PRD_FILE"
    exit 1
fi

echo "=========================================="
echo "PRD Status Report"
echo "=========================================="
echo ""

# Summary counts
total=$(jq '.stories | length' "$PRD_FILE")
complete=$(jq '[.stories[] | select(.status == "complete")] | length' "$PRD_FILE")
in_progress=$(jq '[.stories[] | select(.status == "in_progress")] | length' "$PRD_FILE")
pending=$(jq '[.stories[] | select(.status == "pending")] | length' "$PRD_FILE")
blocked=$(jq '[.stories[] | select(.status == "blocked")] | length' "$PRD_FILE")

echo "Summary:"
echo "  Total Stories:   $total"
echo "  Complete:        $complete"
echo "  In Progress:     $in_progress"
echo "  Pending:         $pending"
echo "  Blocked:         $blocked"
echo ""

# Progress bar
if [ $total -gt 0 ]; then
    percent=$((complete * 100 / total))
    filled=$((percent / 2))
    empty=$((50 - filled))
    bar=$(printf "%${filled}s" | tr ' ' '#')
    bar_empty=$(printf "%${empty}s" | tr ' ' '-')
    echo "Progress: [$bar$bar_empty] $percent%"
    echo ""
fi

# Stories by phase
echo "=========================================="
echo "Stories by Phase"
echo "=========================================="
echo ""

jq -r '.stories | group_by(.phase) | .[] |
    "## " + .[0].phase + "\n" +
    (map("  [" + .status + "] " + .id + " - " + .title) | join("\n")) + "\n"' "$PRD_FILE"

echo ""
echo "=========================================="
echo "Next Up (Highest Priority Pending)"
echo "=========================================="
echo ""

jq -r '[.stories[] | select(.status == "pending")] | sort_by(.priority) | .[0] |
    if . then
        "ID: " + .id + "\n" +
        "Title: " + .title + "\n" +
        "Phase: " + .phase + "\n" +
        "Epic: " + .epic + "\n" +
        "Priority: " + (.priority | tostring) + "\n" +
        "Complexity: " + .estimated_complexity + "\n" +
        "\nDescription:\n" + .description + "\n" +
        "\nAcceptance Criteria:\n" + (.acceptance_criteria | map("  - " + .) | join("\n"))
    else
        "No pending stories! All work is complete."
    end' "$PRD_FILE"
