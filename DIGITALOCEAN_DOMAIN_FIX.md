# DigitalOcean Domain Setup - What You're Seeing

## What DigitalOcean is Showing

When you added `api.soundcloudtoolkit.com` to DigitalOcean, it's showing **NS (Name Server) records**. This means DigitalOcean wants to manage DNS for this subdomain.

## Two Options to Fix This

### ✅ **Option 1: Use CNAME at Your Domain Registrar (RECOMMENDED - Simpler)**

This is the easier approach - you don't need to change name servers.

1. **In DigitalOcean App Platform:**
   - Go to your app → **Settings** → **Domains**
   - You should see `api.soundcloudtoolkit.com` listed
   - Note your app's default domain (e.g., `soundcloud-toolkit-api-xxxxx.ondigitalocean.app`)

2. **At Your Domain Registrar (where you bought soundcloudtoolkit.com):**
   - Go to DNS management
   - Add a **CNAME** record:
     - **Type**: CNAME
     - **Name/Host**: `api`
     - **Value/Target**: `soundcloud-toolkit-api-xxxxx.ondigitalocean.app` (your DigitalOcean app domain)
     - **TTL**: 3600

3. **Back in DigitalOcean:**
   - The domain should verify automatically once DNS propagates
   - DigitalOcean will provision SSL automatically
   - Status will change from "Pending" to "Active"

**Note**: You can ignore the NS records DigitalOcean is showing. You don't need to change name servers at your registrar.

---

### Option 2: Use DigitalOcean Name Servers (More Complex)

If you want DigitalOcean to fully manage DNS:

1. **At Your Domain Registrar:**
   - Change name servers to:
     - `ns1.digitalocean.com`
     - `ns2.digitalocean.com`
     - `ns3.digitalocean.com`

2. **Wait for DNS propagation** (can take 24-48 hours)

3. **In DigitalOcean:**
   - Go to the domain you just added
   - Click "Create a record"
   - Add a **CNAME** record:
     - **Type**: CNAME
     - **Hostname**: `api` (or leave blank for root)
     - **Value**: `soundcloud-toolkit-api-xxxxx.ondigitalocean.app`
     - **TTL**: 1800

**Why Option 1 is Better:**
- ✅ Faster (no name server change needed)
- ✅ Keeps your existing DNS setup
- ✅ Less risk of breaking other DNS records
- ✅ Works immediately

---

## Quick Steps (Recommended Approach)

1. **Get your DigitalOcean app domain:**
   - App Platform → Your App → Settings → Domains
   - Copy the default domain (ends with `.ondigitalocean.app`)

2. **Add CNAME at your domain registrar:**
   - Go to where you manage `soundcloudtoolkit.com` DNS
   - Add: `api` → CNAME → `your-app.ondigitalocean.app`

3. **Wait 15-30 minutes** for DNS to propagate

4. **Check in DigitalOcean:**
   - Domain status should change to "Active"
   - SSL certificate will be provisioned automatically

5. **Test:**
   - Visit: `https://api.soundcloudtoolkit.com/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

---

## Troubleshooting

**Domain stuck on "Pending"?**
- Check DNS propagation: https://dnschecker.org
- Verify CNAME record is correct at your registrar
- Wait longer (can take up to 48 hours, usually much faster)

**SSL certificate not working?**
- Wait 5-10 minutes after domain is verified
- DigitalOcean automatically provisions SSL via Let's Encrypt

**Still seeing NS records?**
- That's normal - DigitalOcean shows them, but you don't need to use them
- Just add the CNAME at your registrar and ignore the NS records
