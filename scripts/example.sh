#!/bin/bash
# Simple script for MMM-GetShellScript

# Get the current date and time
DATETIME=$(date "+%Y-%m-%d %H:%M:%S")

# Log the execution with timestamp
echo "MMM-GetShellScript: Script executed at $DATETIME"

# If any arguments were provided, add them to the message
if [ $# -gt 0 ]; then
  echo "Message: $*"
else
  echo "No additional message provided"
fi

# Log completion
echo "MMM-GetShellScript: Script completed successfully"

# Exit with success
exit 0