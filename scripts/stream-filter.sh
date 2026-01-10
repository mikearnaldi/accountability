#!/bin/bash
# Filter stream-json output to show only relevant content

while IFS= read -r line; do
    # Extract assistant text messages
    if echo "$line" | jq -e '.type == "assistant"' > /dev/null 2>&1; then
        text=$(echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
        if [ -n "$text" ]; then
            echo "$text"
        fi

        # Show tool calls briefly
        tool=$(echo "$line" | jq -r '.message.content[]? | select(.type == "tool_use") | "\(.name): \(.input | keys | join(", "))"' 2>/dev/null)
        if [ -n "$tool" ]; then
            echo -e "\033[0;34m> $tool\033[0m"
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
