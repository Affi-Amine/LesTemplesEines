# 🔐 Security Fix - Remove Exposed Secrets

## ⚠️ CRITICAL: Your Supabase credentials were exposed in the Git repository

GitHub detected hardcoded secrets in the following files:
- `verify-database-data.js`
- `populate-database.js`
- `test-db-connection.js`

These files contain:
- Supabase URL
- Supabase Service Role Key (JWT token)

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

### Step 1: Rotate Your Supabase Credentials (MOST IMPORTANT!)

**You MUST rotate your Supabase service role key immediately:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `vihcjaebkbcdfbwjxqbd`
3. Go to **Settings** → **API**
4. In the **Service Role** section, click **Reset**
5. Copy the new service role key
6. Update your `.env.local` file with the new key

**Why?** The old key is now public on GitHub and anyone can access your database with full admin privileges.

---

### Step 2: Remove Files from Git History

The files are already in your Git history. You need to remove them:

```bash
# Navigate to your project directory
cd /Users/mac/Desktop/MAYNA/Code/eines-final

# Remove the files from git tracking (they're already in .gitignore)
git rm --cached create-admin-simple.js
git rm --cached populate-database.js
git rm --cached test-db-connection.js
git rm --cached test-login-fix.js
git rm --cached verify-database-data.js

# Commit the removal
git commit -m "chore: remove files with exposed credentials"

# Force push to overwrite history
git push origin main --force
```

**⚠️ Warning:** This will rewrite your Git history. Make sure no one else is working on the repository.

---

### Step 3: Alternative - Use BFG Repo-Cleaner (Recommended for Complete History Cleanup)

If you want to completely remove the secrets from ALL commits in history:

```bash
# Install BFG (if not already installed)
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Create a backup
git clone --mirror https://github.com/Affi-Amine/LesTemplesEines.git les-temples-backup.git

# Remove files from entire history
bfg --delete-files verify-database-data.js
bfg --delete-files populate-database.js
bfg --delete-files test-db-connection.js
bfg --delete-files create-admin-simple.js
bfg --delete-files test-login-fix.js

# Clean up and push
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

---

## ✅ Preventive Measures (Already Done)

✅ **Updated `.gitignore`** - The files are now excluded from future commits

Files now in `.gitignore`:
```
create-admin-simple.js
populate-database.js
test-db-connection.js
test-login-fix.js
verify-database-data.js
```

---

## 📋 Going Forward - Best Practices

### 1. Never Hardcode Secrets
**❌ Don't do this:**
```javascript
const supabaseUrl = 'https://vihcjaebkbcdfbwjxqbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**✅ Do this instead:**
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### 2. Use Environment Variables
Always store secrets in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://vihcjaebkbcdfbwjxqbd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

### 3. Check Before Committing
Before every commit, check for secrets:
```bash
# Check what files will be committed
git status

# Review changes
git diff

# Make sure no .env files or scripts with secrets are staged
```

### 4. Use Git Hooks (Optional)
Install a pre-commit hook to prevent committing secrets:
```bash
npm install --save-dev @commitlint/cli
# Add git-secrets or similar tool
```

---

## 🔍 Files to Keep vs Delete

### ✅ Keep These (Safe for Git)
- All files in `/app`, `/components`, `/lib`
- `package.json`
- Configuration files
- Database schema (`/database/database.sql`)
- Migration files (`/database/migrations/*.sql`)

### ❌ Delete/Ignore These (Contain Secrets)
- `verify-database-data.js`
- `populate-database.js`
- `test-db-connection.js`
- `create-admin-simple.js`
- `test-login-fix.js`
- Any `.env*` files

---

## 📝 Checklist

- [ ] Rotate Supabase service role key
- [ ] Update `.env.local` with new credentials
- [ ] Remove files from git tracking
- [ ] Force push to GitHub
- [ ] Verify files are not in repository anymore
- [ ] Test that application still works with new credentials
- [ ] Delete local copies of the exposed scripts (optional)

---

## 🆘 If You Need Help

If you need to keep these scripts for development:

1. **Keep them locally** but never commit them
2. **Create template versions** without real credentials:

```javascript
// verify-database-data.template.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';
```

3. **Document in README** how to set up these scripts

---

## ⚠️ Bottom Line

**The most important step is rotating your Supabase credentials IMMEDIATELY.**

Once the old credentials are rotated, they become useless even if they're in the Git history.

---

**Date**: 2025-10-25
**Priority**: CRITICAL 🔴
**Status**: Action Required
