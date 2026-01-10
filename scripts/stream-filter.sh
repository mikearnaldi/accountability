#!/bin/bash
# Filter stream-json output to show only relevant content

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
            echo -e "\033[0;34m$tool_info\033[0m"
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
