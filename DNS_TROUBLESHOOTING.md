# DNS Troubleshooting for api.soundcloudtoolkit.com

## Issue: Safari Can't Find the Server

This means DNS isn't resolving correctly. Let's fix it step by step.

### Step 1: Verify CNAME Record at Namecheap

1. **Go to Namecheap Dashboard**
   - Navigate to Domain List → `soundcloudtoolkit.com` → Advanced DNS

2. **Check CNAME Record:**
   - Should have ONE CNAME record:
     - **Type**: CNAME
     - **Host**: `api`
     - **Value**: `sctoolkit-backend-l882y.ondigitalocean.app`
     - **TTL**: Automatic or 3600

3. **Remove ALL NS Records for `api` subdomain:**
   - If you see any NS records for `api.soundcloudtoolkit.com`, DELETE them
   - You should ONLY have the CNAME record

### Step 2: Verify DNS Propagation

1. **Check DNS Checker:**
   - Visit: https://dnschecker.org
   - Enter: `api.soundcloudtoolkit.com`
   - Select: **CNAME**
   - Should show: `sctoolkit-backend-l882y.ondigitalocean.app` globally
   - If not showing everywhere, wait 15-30 minutes

2. **Test from Terminal:**
   ```bash
   nslookup api.soundcloudtoolkit.com
   # or
   dig api.soundcloudtoolkit.com CNAME
   ```
   Should return: `sctoolkit-backend-l882y.ondigitalocean.app`

### Step 3: Check DigitalOcean Domain Status

1. **Go to DigitalOcean App Platform**
   - Your App → Settings → Domains
   - Find `api.soundcloudtoolkit.com`
   - **What status does it show?**
     - ✅ **"Active"** (green) = Working, wait for DNS
     - ⏳ **"Pending"** = Waiting for verification
     - ❌ **"Error"** = Check error message

2. **If "Pending":**
   - Wait 5-30 minutes
   - DigitalOcean verifies DNS automatically
   - Refresh the page to check status

3. **If "Error":**
   - Click on the domain to see error details
   - Common errors:
     - "DNS not found" → CNAME not set correctly
     - "SSL provisioning failed" → Wait and retry

### Step 4: Test Direct Access

Once DNS propagates:

1. **Test Health Endpoint:**
   ```
   https://api.soundcloudtoolkit.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **If you get SSL errors:**
   - Wait 5-10 minutes
   - DigitalOcean automatically provisions SSL via Let's Encrypt
   - Try again after waiting

### Step 5: Common Issues

**Problem**: CNAME exists but domain doesn't resolve
- **Solution**: 
  1. Verify CNAME value is exactly: `sctoolkit-backend-l882y.ondigitalocean.app` (no https://, no trailing slash)
  2. Wait 15-30 minutes for DNS propagation
  3. Clear browser DNS cache (Safari: Settings → Privacy → Clear Website Data)

**Problem**: DNS checker shows CNAME but Safari can't find it
- **Solution**: 
  1. Clear Safari cache: Safari → Clear History → All History
  2. Try different browser (Chrome, Firefox)
  3. Try from different network (mobile data)
  4. Wait longer for DNS propagation (can take up to 48 hours, usually 15-30 min)

**Problem**: Domain shows "Error" in DigitalOcean
- **Solution**: 
  1. Verify CNAME is correct at Namecheap
  2. Remove any NS records for `api` subdomain
  3. Wait 15 minutes, then try adding domain again in DigitalOcean

### Step 6: Temporary Workaround

If DNS is taking too long, you can temporarily use the DigitalOcean default URL:
- Backend: `https://sctoolkit-backend-l882y.ondigitalocean.app`
- Update `vercel.json` to use this URL temporarily
- Once DNS works, switch back to `api.soundcloudtoolkit.com`

---

## Quick Checklist

- [ ] CNAME record exists at Namecheap: `api` → `sctoolkit-backend-l882y.ondigitalocean.app`
- [ ] NO NS records for `api` subdomain at Namecheap
- [ ] DNS checker shows CNAME globally (wait if not)
- [ ] DigitalOcean shows domain status as "Active" or "Pending"
- [ ] Waited 15-30 minutes after setting CNAME
- [ ] Cleared browser cache
- [ ] Tested from different browser/network

---

## Still Not Working?

1. **Double-check CNAME at Namecheap:**
   - Value must be EXACTLY: `sctoolkit-backend-l882y.ondigitalocean.app`
   - No `https://`, no trailing slash, no spaces

2. **Wait longer:**
   - DNS can take up to 48 hours (usually 15-30 minutes)
   - Be patient and check again later

3. **Contact support:**
   - DigitalOcean support if domain shows error
   - Namecheap support if CNAME isn't saving
