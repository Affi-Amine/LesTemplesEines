#!/bin/bash

# Script to remove files with exposed secrets from Git repository
# Run this after you've rotated your Supabase credentials

echo "🔐 Removing files with exposed secrets from Git..."
echo ""

# Remove files from git tracking
echo "📝 Removing files from Git tracking..."
git rm --cached create-admin-simple.js 2>/dev/null
git rm --cached populate-database.js 2>/dev/null
git rm --cached test-db-connection.js 2>/dev/null
git rm --cached test-login-fix.js 2>/dev/null
git rm --cached verify-database-data.js 2>/dev/null
git rm --cached scripts/apply-rls-policies.js 2>/dev/null

echo ""
echo "✅ Files removed from tracking"
echo ""

# Show status
echo "📊 Current Git status:"
git status

echo ""
echo "🎯 Next steps:"
echo "1. Review the changes above"
echo "2. Run: git commit -m 'chore: remove files with exposed credentials'"
echo "3. Run: git push origin main --force"
echo ""
echo "⚠️  IMPORTANT: Make sure you've rotated your Supabase credentials first!"
echo "    Go to: https://app.supabase.com → Settings → API → Reset Service Role Key"
echo ""
