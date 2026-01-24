# Troubleshooting Guide

## Issue 1: Custom Domain `api.soundcloudtoolkit.com` Not Loading

### Check DNS Configuration

1. **Verify CNAME Record at Your Domain Registrar**
   - Go to where you manage `soundcloudtoolkit.com` DNS (Namecheap, GoDaddy, Cloudflare, etc.)
   - Check if CNAME record exists:
     - **Type**: CNAME
     - **Name/Host**: `api`
     - **Value/Target**: `sctoolkit-backend-l882y.ondigitalocean.app`
   - If missing, add it now

2. **Check DNS Propagation**
   - Visit: https://dnschecker.org
   - Enter: `api.soundcloudtoolkit.com`
   - Select record type: **CNAME**
   - Check if it resolves to: `sctoolkit-backend-l882y.ondigitalocean.app`
   - If not, wait 15-30 minutes and check again (can take up to 48 hours)

3. **Verify Domain in DigitalOcean**
   - Go to DigitalOcean App Platform → Your App → Settings → Domains
   - Check if `api.soundcloudtoolkit.com` is listed
   - Status should be "Active" (green checkmark)
   - If "Pending", DNS hasn't propagated yet

4. **Test Direct Access**
   - Try: `https://api.soundcloudtoolkit.com/health`
   - Should return: `{"status":"ok","timestamp":"..."}`
   - If you get SSL errors, wait a few more minutes for SSL certificate provisioning

### Common DNS Issues

**Problem**: CNAME record not found
- **Solution**: Add the CNAME record at your domain registrar

**Problem**: DNS not propagated
- **Solution**: Wait 15-30 minutes, then check again with dnschecker.org

**Problem**: Domain shows "Pending" in DigitalOcean
- **Solution**: Wait for DNS to propagate, then DigitalOcean will verify and provision SSL

**Problem**: SSL certificate errors
- **Solution**: DigitalOcean automatically provisions SSL via Let's Encrypt. Wait 5-10 minutes after domain is verified.

---

## Issue 2: Frontend Not Loading

### Check Frontend Deployment

1. **Where is your frontend hosted?**
   - Vercel? Netlify? Another platform?
   - Check if it's deployed and accessible

2. **Update API URL in Frontend**

   If frontend is on **Vercel**:
   
   a. **Update Environment Variable**
      - Go to Vercel dashboard → Your project → Settings → Environment Variables
      - Find or add: `NEXT_PUBLIC_API_URL` or `VITE_API_BASE`
      - Set value to: `https://api.soundcloudtoolkit.com` (or `https://sctoolkit-backend-l882y.ondigitalocean.app` if custom domain isn't ready)
      - Redeploy frontend

   b. **Update vercel.json** (if using API rewrites)
      - The current `frontend-UI/vercel.json` points to old Vercel backend
      - Update the rewrite destination:
      ```json
      {
        "rewrites": [
          {
            "source": "/api/:path*",
            "destination": "https://api.soundcloudtoolkit.com/api/:path*"
          }
        ]
      }
      ```
      - Or remove rewrites if frontend calls API directly

3. **Check Frontend Code**
   - Look for hardcoded API URLs
   - Search for: `soundcloud-tool-api.vercel.app` or old backend URLs
   - Update to: `https://api.soundcloudtoolkit.com` or your DigitalOcean URL

4. **Redeploy Frontend**
   - After updating environment variables and code
   - Trigger a new deployment
   - Wait for build to complete

### Frontend Configuration Files to Check

1. **Environment Variables** (`.env.local` or Vercel dashboard):
   ```
   NEXT_PUBLIC_API_URL=https://api.soundcloudtoolkit.com
   # or
   VITE_API_BASE=https://api.soundcloudtoolkit.com
   ```

2. **vercel.json** (if using API rewrites):
   - Update destination to point to DigitalOcean backend

3. **Frontend code** (check `src/` or `frontend-UI/src/`):
   - Look for API base URL configuration
   - Update any hardcoded URLs

---

## Quick Diagnostic Steps

### Test Backend API

1. **Test DigitalOcean default URL:**
   ```
   https://sctoolkit-backend-l882y.ondigitalocean.app/health
   ```
   ✅ Should return: `{"status":"ok","timestamp":"..."}`

2. **Test custom domain (if DNS is set up):**
   ```
   https://api.soundcloudtoolkit.com/health
   ```
   ✅ Should return: `{"status":"ok","timestamp":"..."}`

3. **Test API endpoint:**
   ```
   https://sctoolkit-backend-l882y.ondigitalocean.app/api/auth/me
   ```
   ✅ Should return authentication status

### Test Frontend

1. **Check if frontend is deployed:**
   - Visit your frontend URL (Vercel, Netlify, etc.)
   - Does it load at all?

2. **Check browser console:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for API connection errors
   - Check Network tab for failed API requests

3. **Check API calls:**
   - Frontend should be calling: `https://api.soundcloudtoolkit.com/api/...`
   - Or: `https://sctoolkit-backend-l882y.ondigitalocean.app/api/...`

---

## Step-by-Step Fix

### Fix Custom Domain

1. ✅ Add CNAME record at domain registrar: `api` → `sctoolkit-backend-l882y.ondigitalocean.app`
2. ✅ Wait 15-30 minutes for DNS propagation
3. ✅ Check status in DigitalOcean (should be "Active")
4. ✅ Test: `https://api.soundcloudtoolkit.com/health`

### Fix Frontend

1. ✅ Identify where frontend is hosted (Vercel, Netlify, etc.)
2. ✅ Update API URL environment variable to DigitalOcean backend
3. ✅ Update `vercel.json` if using API rewrites
4. ✅ Check frontend code for hardcoded API URLs
5. ✅ Redeploy frontend
6. ✅ Test frontend → should now connect to DigitalOcean backend

---

## Still Having Issues?

### Check DigitalOcean Logs

1. Go to DigitalOcean App Platform → Your App
2. Click "Runtime Logs"
3. Look for errors or warnings
4. Check if app is running properly

### Check DNS Status

1. Use https://dnschecker.org
2. Enter: `api.soundcloudtoolkit.com`
3. Check CNAME record globally
4. Should point to: `sctoolkit-backend-l882y.ondigitalocean.app`

### Verify Environment Variables

In DigitalOcean App Platform → Settings → Environment Variables, ensure:
- ✅ `SOUNDCLOUD_REDIRECT_URI=https://api.soundcloudtoolkit.com/api/auth/callback`
- ✅ `APP_URLS` includes both frontend and `https://api.soundcloudtoolkit.com`
- ✅ All other variables are set correctly
