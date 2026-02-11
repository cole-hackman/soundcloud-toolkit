# Troubleshooting: api.soundcloudtoolkit.com Not Loading

## Quick Diagnostic Steps

### 1. Test DNS Resolution

**Check if DNS is working:**
```bash
# In terminal or use online tool
nslookup api.soundcloudtoolkit.com
# or
dig api.soundcloudtoolkit.com
```

**Expected result:**
- Should resolve to: `sctoolkit-backend-l882y.ondigitalocean.app`
- If it doesn't resolve, DNS hasn't propagated yet

**Online DNS checker:**
- Visit: https://dnschecker.org
- Enter: `api.soundcloudtoolkit.com`
- Select: **CNAME**
- Should show: `sctoolkit-backend-l882y.ondigitalocean.app` globally

### 2. Check DigitalOcean App Platform

**Verify domain is added:**
1. Go to DigitalOcean App Platform
2. Your App → Settings → Domains
3. Check if `api.soundcloudtoolkit.com` is listed
4. **What status does it show?**
   - ✅ "Active" = Domain is verified
   - ⏳ "Pending" = Waiting for verification
   - ❌ "Error" = Check error message

**If domain is NOT listed:**
- Add it: Settings → Domains → Add Domain
- Enter: `api.soundcloudtoolkit.com`
- DigitalOcean will verify and provision SSL

### 3. Test Direct DigitalOcean URL

**Test if the app itself is working:**
```
https://sctoolkit-backend-l882y.ondigitalocean.app/health
```

**Expected result:**
- Should return: `{"status":"ok","timestamp":"..."}`
- If this works, the app is running
- If this doesn't work, the app might be down

### 4. Check DNS Records

**In Namecheap:**
- Verify CNAME record exists:
  - Type: CNAME
  - Host: `api`
  - Value: `sctoolkit-backend-l882y.ondigitalocean.app`
  - TTL: Automatic or 3600

**If CNAME doesn't exist:**
- Add it in Namecheap DNS settings
- Wait 15-30 minutes for propagation

### 5. Common Issues & Solutions

**Issue: DNS not resolving**
- **Solution**: 
  1. Verify CNAME exists in Namecheap
  2. Wait 15-30 minutes (can take up to 48 hours)
  3. Check DNS checker: https://dnschecker.org

**Issue: Domain not added in App Platform**
- **Solution**: 
  1. Go to Settings → Domains
  2. Click "Add Domain"
  3. Enter: `api.soundcloudtoolkit.com`
  4. Wait for verification

**Issue: SSL certificate not ready**
- **Solution**: 
  1. Wait 5-10 minutes after domain is verified
  2. DigitalOcean automatically provisions SSL
  3. Try again after waiting

**Issue: App not running**
- **Solution**: 
  1. Check DigitalOcean App Platform → Runtime Logs
  2. Verify app is deployed and running
  3. Test direct URL: `https://sctoolkit-backend-l882y.ondigitalocean.app/health`

**Issue: Browser cache**
- **Solution**: 
  1. Clear browser cache
  2. Try incognito/private mode
  3. Try different browser
  4. Try from different network (mobile data)

---

## Step-by-Step Fix

### Step 1: Verify CNAME in Namecheap
- [ ] CNAME record exists: `api` → `sctoolkit-backend-l882y.ondigitalocean.app`
- [ ] No conflicting records

### Step 2: Verify Domain in DigitalOcean
- [ ] Domain added in App Platform → Settings → Domains
- [ ] Status is "Active" or "Pending"

### Step 3: Test DNS Resolution
- [ ] DNS checker shows CNAME globally
- [ ] `nslookup` or `dig` resolves correctly

### Step 4: Test App
- [ ] Direct URL works: `https://sctoolkit-backend-l882y.ondigitalocean.app/health`
- [ ] App is running (check logs)

### Step 5: Wait for Propagation
- [ ] Waited 15-30 minutes after adding CNAME
- [ ] Cleared browser cache
- [ ] Tested from different browser/network

---

## Quick Test Commands

```bash
# Test DNS
nslookup api.soundcloudtoolkit.com
dig api.soundcloudtoolkit.com CNAME

# Test HTTPS
curl https://api.soundcloudtoolkit.com/health
curl -I https://api.soundcloudtoolkit.com/health

# Test direct app URL
curl https://sctoolkit-backend-l882y.ondigitalocean.app/health
```

---

## What to Check Right Now

1. **Is the CNAME record in Namecheap?**
   - Go to Namecheap → DNS settings
   - Verify `api` CNAME exists

2. **Is the domain added in DigitalOcean App Platform?**
   - Settings → Domains
   - Is `api.soundcloudtoolkit.com` listed?

3. **Does the direct app URL work?**
   - Test: `https://sctoolkit-backend-l882y.ondigitalocean.app/health`
   - If this doesn't work, the app might be down

4. **What error do you see?**
   - "Safari can't find the server" = DNS issue
   - SSL error = Certificate not ready
   - Timeout = App might be down
   - 404 = Route issue

---

## Next Steps

Please check:
1. ✅ CNAME exists in Namecheap
2. ✅ Domain added in DigitalOcean App Platform
3. ✅ Direct app URL works
4. ✅ DNS has propagated (check dnschecker.org)

Then let me know what you find!
