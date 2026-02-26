#!/bin/bash
# Run integration tests and log full output
LOG=/tmp/apty-integration.log
echo "Running integration tests... (log: $LOG)"
NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.integration.json --forceExit --verbose 2>&1 | tee "$LOG"
echo ""
echo "Exit code: ${PIPESTATUS[0]}"
