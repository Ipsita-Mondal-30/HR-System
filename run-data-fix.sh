#!/bin/bash

echo "🔧 Running HR System Data Fix..."
echo "=================================="

# Navigate to backend directory
cd "$(dirname "$0")"

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install

# Run the data fix script
echo "🔧 Running data fix script..."
node fix-data-issues.js

echo "✅ Data fix completed!"
echo "You can now test your application."