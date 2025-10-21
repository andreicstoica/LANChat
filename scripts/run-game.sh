#!/bin/bash

# Game runner script with proper cleanup
# This script ensures all processes are killed when Ctrl+C is pressed

echo "🎲 Starting D&D Game Mode..."
echo "Press Ctrl+C to stop all processes"

# Function to cleanup all processes
cleanup() {
    echo ""
    echo "🛑 Shutting down all game processes..."
    
    # Kill all bun processes related to the game
    pkill -f "bun.*src/game-agents"
    pkill -f "bun.*src/server.*--game"
    
    # Wait a moment for graceful shutdown
    sleep 1
    
    # Force kill if any are still running
    pkill -9 -f "bun.*src/game-agents"
    pkill -9 -f "bun.*src/server.*--game"
    
    echo "All processes terminated. Goodbye!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the game server
bun run src/server/index.ts --game &

# Wait for the server process
wait
