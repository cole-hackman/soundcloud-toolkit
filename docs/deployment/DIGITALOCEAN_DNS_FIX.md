# Fix: Add CNAME Record in DigitalOcean

## The Problem

DigitalOcean shows "Directs to: Unknown" because:
- ✅ DigitalOcean is managing DNS (NS records exist)
- ❌ But there's NO CNAME or A record to route traffic to your app

## The Solution

Add a CNAME record in DigitalOcean's DNS management.

### Step-by-Step Instructions

1. **In DigitalOcean, go to the DNS management page:**
   - You're already there (the page showing the 3 NS records)
   - Click the blue **"Create a record"** button

2. **Fill in the CNAME record:**
   - **Record Type**: Select **"CNAME"** (not A record!)
   - **Hostname**: Enter `api` (or leave blank - DigitalOcean will use the domain)
   - **Will direct to**: Enter `sctoolkit-backend-l882y.ondigitalocean.app`
     - This is your app's default DigitalOcean URL
     - No `https://`, no trailing slash
   - **TTL (seconds)**: `3600` (or leave default)

3. **Click "Create Record"**

4. **Verify:**
   - You should now see:
     - 3 NS records (existing)
     - 1 SOA record (existing)
     - **1 NEW CNAME record** pointing to your app

5. **Wait 5-15 minutes:**
   - DNS needs to propagate
   - DigitalOcean will verify the record

6. **Check App Platform:**
   - Go back to App Platform → Resources
   - `api.soundcloudtoolkit.com` should now show "Directs to: sctoolkit-backend-l882y.ondigitalocean.app"
   - Status should change to "Active"

7. **Test:**
   ```
   https://api.soundcloudtoolkit.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

---

## Important Notes

### Why This Approach?

Since DigitalOcean is managing DNS (NS records exist), you need to add records **IN DigitalOcean**, not at Namecheap.

### Two Options (Choose One):

**Option A: Use DigitalOcean DNS (Current Setup)**
- ✅ Keep NS records in DigitalOcean
- ✅ Add CNAME record in DigitalOcean
- ❌ Remove CNAME from Namecheap (if you added one)

**Option B: Use Namecheap DNS (Alternative)**
- ❌ Remove NS records from DigitalOcean
- ❌ Remove domain from DigitalOcean DNS management
- ✅ Add CNAME at Namecheap: `api` → `sctoolkit-backend-l882y.ondigitalocean.app`
- ✅ Add domain in App Platform → Settings → Domains (for SSL)

**Recommendation**: Since you already have NS records in DigitalOcean, go with **Option A** - just add the CNAME record in DigitalOcean.

---

## After Adding CNAME

1. **Wait 5-15 minutes** for DNS propagation
2. **Check App Platform Resources tab:**
   - Should show "Directs to: sctoolkit-backend-l882y.ondigitalocean.app"
3. **Test the domain:**
   - `https://api.soundcloudtoolkit.com/health`
4. **SSL will be provisioned automatically** (takes 5-10 minutes after DNS resolves)

---

## Troubleshooting

**If CNAME doesn't appear:**
- Refresh the page
- Check you selected "CNAME" not "A" record
- Verify the value is exactly: `sctoolkit-backend-l882y.ondigitalocean.app`

**If still shows "Unknown":**
- Wait 5-10 minutes
- Check DNS records page - CNAME should be listed
- Try removing and re-adding the domain in App Platform → Settings → Domains

**If domain still doesn't load:**
- Wait 15-30 minutes for full DNS propagation
- Clear browser cache
- Test from different browser/network
