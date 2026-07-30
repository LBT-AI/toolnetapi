#!/usr/bin/env bash

# Determine port (default 20127)
PORT=${PORT:-20127}

echo "🔍 Checking ToolNet API Server status on port $PORT..."

# Check if server is running on port
if ! curl -s http://127.0.0.1:$PORT/api/health >/dev/null 2>&1; then
  echo "🚀 Starting ToolNet API Server in background on port $PORT..."
  nohup npm run dev < /dev/null > /tmp/toolnetapi.log 2>&1 &
  disown 2>/dev/null || true
  
  # Wait for server readiness
  for i in {1..15}; do
    if curl -s http://127.0.0.1:$PORT/api/health >/dev/null 2>&1; then
      echo "✅ ToolNet API Server is ready!"
      break
    fi
    sleep 1
  done
else
  echo "✅ ToolNet API Server is already running on port $PORT!"
fi

# Launch ToolNet CLI
echo "🖥️  Launching ToolNet CLI..."
toolnet "$@"
