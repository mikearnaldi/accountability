#!/bin/bash

# PRD Update - Update the status of a story in the PRD
# Usage: ./scripts/prd-update.sh <story-id> <status>
# Status: pending, in_progress, complete, blocked

PRD_FILE="prd.json"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <story-id> <status>"
    echo "Status options: pending, in_progress, complete, blocked"
    exit 1
fi

STORY_ID="$1"
NEW_STATUS="$2"

# Validate status
case "$NEW_STATUS" in
    pending|in_progress|complete|blocked)
        ;;
    *)
        echo "Error: Invalid status '$NEW_STATUS'"
        echo "Valid options: pending, in_progress, complete, blocked"
        exit 1
        ;;
esac

# Check if story exists
story_exists=$(jq --arg id "$STORY_ID" '[.stories[] | select(.id == $id)] | length' "$PRD_FILE")

if [ "$story_exists" -eq 0 ]; then
    echo "Error: Story '$STORY_ID' not found in PRD"
    exit 1
fi

# Get current status
current_status=$(jq -r --arg id "$STORY_ID" '.stories[] | select(.id == $id) | .status' "$PRD_FILE")

echo "Updating story $STORY_ID: $current_status -> $NEW_STATUS"

# Update the status
jq --arg id "$STORY_ID" --arg status "$NEW_STATUS" \
    '(.stories[] | select(.id == $id)).status = $status |
     .updated_at = (now | strftime("%Y-%m-%d"))' \
    "$PRD_FILE" > "${PRD_FILE}.tmp" && mv "${PRD_FILE}.tmp" "$PRD_FILE"

echo "Done!"
