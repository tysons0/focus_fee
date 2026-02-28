#!/bin/bash
# Auto pull & push every 30 seconds
# Run in Git Bash: bash auto-pull.sh
# Press Ctrl+C to stop

echo "Auto pull & push every 30 seconds. Press Ctrl+C to stop."

while true; do
    timestamp=$(date +%H:%M:%S)

    # Pull
    pullResult=$(git pull 2>&1)
    if [ $? -eq 0 ]; then
        if echo "$pullResult" | grep -q "Already up to date"; then
            echo "[$timestamp] Pull: up to date"
        else
            echo "[$timestamp] Pull: $pullResult"
        fi
    else
        echo "[$timestamp] Pull failed: $pullResult"
    fi

    # Push
    pushResult=$(git push 2>&1)
    if [ $? -eq 0 ]; then
        if echo "$pushResult" | grep -q "Everything up-to-date"; then
            echo "[$timestamp] Push: up to date"
        else
            echo "[$timestamp] Push: $pushResult"
        fi
    else
        echo "[$timestamp] Push failed: $pushResult"
    fi

    sleep 30
done
