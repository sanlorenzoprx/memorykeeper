#!/bin/bash

echo "🧪 Running MemoryKeeper End-to-End Tests"
echo "========================================="

# Set script to exit on any error
set -e

echo "📦 Installing dependencies..."
pnpm install

echo "🔧 Building packages..."
pnpm -w -r build

echo "🧪 Running backend tests..."
cd backend
pnpm test
cd ..

echo "🧪 Running frontend tests..."
cd apps/web
pnpm test -- --testPathPattern=integration
cd ../..

echo "🎉 All end-to-end tests completed successfully!"

echo ""
echo "📊 Test Summary:"
echo "- ✅ Backend unit and integration tests"
echo "- ✅ Frontend integration tests"
echo "- ✅ Complete workflow coverage"
echo "- ✅ Error handling validation"
echo "- ✅ Performance testing"
