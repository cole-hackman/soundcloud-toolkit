# DNS Verification Steps

## Current Setup ✅

- **Root domain** (`soundcloudtoolkit.com`): Using registrar name servers (dns1.registrar-servers.com, dns2.registrar-servers.com) - **This is fine!**
- **Subdomain** (`api.soundcloudtoolkit.com`): CNAME pointing to DigitalOcean - **This is correct!**

## Verification Steps

### 1. Verify CNAME Record

Check that the CNAME is correctly set:

**At your domain registrar:**
- Go to DNS management
- Verify you have:
  - **Type**: CNAME
  - **Name/Host**: `api`
  - **Value/Target**: `sctoolkit-backend-l882y.ondigitalocean.app`
  - **TTL**: 3600 (or default)

**Using DNS Checker:**
- Visit: https://dnschecker.org
- Enter: `api.soundcloudtoolkit.com`
- Select: **CNAME**
- Should show: `sctoolkit-backend-l882y.ondigitalocean.app` globally

### 2. Verify in DigitalOcean

1. **Go to DigitalOcean App Platform**
   - Navigate to your app → Settings → Domains
   - Check if `api.soundcloudtoolkit.com` is listed
   - **Status should be "Active"** (green checkmark)

2. **If status is "Pending":**
   - DigitalOcean is waiting for DNS verification
   - This can take 5-30 minutes after DNS propagates
   - Check back in a few minutes

3. **If you see errors:**
   - Click on the domain to see error details
   - Common issues:
     - DNS not propagated yet (wait longer)
     - CNAME value incorrect (verify at registrar)
     - SSL certificate provisioning (wait 5-10 minutes)

### 3. Test the Domain

Once DNS is propagated and DigitalOcean shows "Active":

1. **Test health endpoint:**
   ```
   https://api.soundcloudtoolkit.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test root endpoint:**
   ```
   https://api.soundcloudtoolkit.com/
   ```
   Should return API info JSON

3. **Check SSL:**
   - Should automatically have HTTPS (green lock icon)
   - DigitalOcean provisions SSL via Let's Encrypt automatically

### 4. Common Issues & Solutions

**Problem**: DNS checker shows CNAME but DigitalOcean shows "Pending"
- **Solution**: Wait 5-30 minutes for DigitalOcean to verify. Refresh the page.

**Problem**: DNS checker shows CNAME but domain doesn't load
- **Solution**: 
  1. Verify CNAME value is exactly: `sctoolkit-backend-l882y.ondigitalocean.app` (no https://, no trailing slash)
  2. Check DigitalOcean domain status
  3. Wait for SSL certificate provisioning (5-10 minutes after domain is verified)

**Problem**: SSL certificate errors
- **Solution**: DigitalOcean automatically provisions SSL. Wait 5-10 minutes after domain shows "Active" status.

**Problem**: Domain loads but shows "Cannot GET /" or errors
- **Solution**: This is normal - the backend is working. The frontend needs to be updated to use this URL.

### 5. Next Steps

Once `api.soundcloudtoolkit.com` is working:

1. ✅ **Update SoundCloud OAuth Redirect URI:**
   - Go to SoundCloud Developer Dashboard
   - Update redirect URI to: `https://api.soundcloudtoolkit.com/api/auth/callback`

2. ✅ **Update Frontend:**
   - The `vercel.json` is already updated to use `https://api.soundcloudtoolkit.com`
   - Redeploy frontend on Vercel
   - Or update environment variables if needed

3. ✅ **Update Environment Variables in DigitalOcean:**
   - Verify `SOUNDCLOUD_REDIRECT_URI=https://api.soundcloudtoolkit.com/api/auth/callback`
   - Verify `APP_URLS` includes `https://api.soundcloudtoolkit.com`

## Quick Test Commands

```bash
# Test DNS resolution
nslookup api.soundcloudtoolkit.com

# Test CNAME
dig api.soundcloudtoolkit.com CNAME

# Test HTTPS endpoint
curl https://api.soundcloudtoolkit.com/health
```

## Expected Results

✅ **DNS Checker**: Shows CNAME → `sctoolkit-backend-l882y.ondigitalocean.app`  
✅ **DigitalOcean**: Domain status = "Active"  
✅ **HTTPS**: SSL certificate working (green lock)  
✅ **Health Check**: `https://api.soundcloudtoolkit.com/health` returns `{"status":"ok"}`  

If all of these are ✅, your domain is fully configured!
