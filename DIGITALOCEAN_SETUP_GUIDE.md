# DigitalOcean Setup Guide - Step by Step

This guide will walk you through setting up your backend on DigitalOcean App Platform with your custom domain `api.soundcloudtoolkit.com`.

## Prerequisites

- ✅ DigitalOcean account (sign up at [digitalocean.com](https://www.digitalocean.com) if needed)
- ✅ GitHub repository with your code (already done - we just pushed!)
- ✅ Access to your domain DNS settings (for `soundcloudtoolkit.com`)
- ✅ Your environment variables from Render (we'll copy them over)

---

## Step 1: Create App on DigitalOcean

1. **Go to DigitalOcean App Platform**
   - Visit: https://cloud.digitalocean.com/apps
   - Log in to your account

2. **Create New App**
   - Click the **"Create App"** button (top right)

3. **Connect GitHub Repository**
   - Click **"GitHub"** as your source
   - If not connected, authorize DigitalOcean to access your GitHub
   - Select your repository: `cole-hackman/soundcloud-toolkit`
   - Select branch: `main`
   - Click **"Next"**

4. **Configure App**
   - DigitalOcean should auto-detect the `.do/app.yaml` file
   - You should see:
     - **Name**: `soundcloud-toolkit-api`
     - **Region**: `nyc` (or choose closest to you)
     - **Service**: `api` (Node.js)
   - Review the build settings:
     - Build Command: `npm install && npm run prisma:generate`
     - Run Command: `npm start`
   - Click **"Next"**

5. **Configure Resources**
   - **Plan**: Basic
   - **Size**: Basic XXS ($5/month) - 512MB RAM, 1 vCPU
   - Click **"Next"**

---

## Step 2: Set Environment Variables

1. **Before finalizing, click "Edit" on the Environment Variables section**

2. **Add all your environment variables from Render:**

   Click **"Edit"** and add each variable:

   ```
   NODE_ENV=production
   ```

   ```
   DATABASE_URL=postgres://... (your Neon database URL)
   ```

   ```
   SOUNDCLOUD_CLIENT_ID=your_client_id
   ```

   ```
   SOUNDCLOUD_CLIENT_SECRET=your_client_secret
   ```

   ```
   SOUNDCLOUD_REDIRECT_URI=https://api.soundcloudtoolkit.com/api/auth/callback
   ```
   ⚠️ **Note**: Use your custom domain here, not the DigitalOcean default domain

   ```
   SESSION_SECRET=your_session_secret
   ```

   ```
   ENCRYPTION_KEY=your_32_character_encryption_key
   ```

   ```
   APP_URL=https://your-frontend-domain.com
   ```
   (Your frontend URL - e.g., if on Vercel)

   ```
   APP_URLS=https://your-frontend-domain.com,https://api.soundcloudtoolkit.com
   ```
   ⚠️ **Note**: Include both frontend and API domains

3. **Important**: Do NOT set `PORT` - DigitalOcean sets this automatically

4. **Click "Save"** after adding all variables

---

## Step 3: Deploy the App

1. **Review your configuration**
   - Double-check all environment variables
   - Verify build and run commands

2. **Click "Create Resources"** or **"Deploy"**
   - DigitalOcean will start building and deploying your app
   - This takes 3-5 minutes

3. **Wait for deployment**
   - You'll see build logs in real-time
   - Once complete, you'll get a default URL like: `soundcloud-toolkit-api-xxxxx.ondigitalocean.app`

---

## Step 4: Set Up Custom Domain (api.soundcloudtoolkit.com)

### Option A: Add Domain in DigitalOcean (Recommended)

1. **In your app dashboard, go to Settings → Domains**

2. **Click "Add Domain"**

3. **Enter your domain**
   - Type: `api.soundcloudtoolkit.com`
   - Click **"Add Domain"**

4. **DigitalOcean will show you DNS records to add**
   - You'll see something like:
     ```
     Type: CNAME
     Name: api
     Value: your-app-name.ondigitalocean.app
     ```

5. **Add DNS Record to Your Domain Provider**
   - Go to your domain registrar (where you manage `soundcloudtoolkit.com`)
   - Navigate to DNS settings
   - Add a **CNAME** record:
     - **Name/Host**: `api`
     - **Value/Target**: The value DigitalOcean provided (e.g., `soundcloud-toolkit-api-xxxxx.ondigitalocean.app`)
     - **TTL**: 3600 (or default)

6. **Wait for DNS Propagation**
   - Can take 5 minutes to 48 hours (usually 15-30 minutes)
   - Check status in DigitalOcean dashboard - it will show "Pending" until DNS propagates

7. **Verify Domain**
   - Once DNS propagates, DigitalOcean will automatically provision SSL certificate
   - Status will change to "Active" with a green checkmark

### Option B: Manual DNS Configuration

If you prefer to set up DNS manually:

1. **Get your app's domain from DigitalOcean**
   - In App Platform, go to your app → Settings → Domains
   - Note the default domain (e.g., `soundcloud-toolkit-api-xxxxx.ondigitalocean.app`)

2. **Add CNAME record at your DNS provider**
   - **Type**: CNAME
   - **Name**: `api`
   - **Value**: `soundcloud-toolkit-api-xxxxx.ondigitalocean.app` (your DigitalOcean app domain)
   - **TTL**: 3600

3. **Add domain in DigitalOcean**
   - Go to Settings → Domains
   - Click "Add Domain"
   - Enter: `api.soundcloudtoolkit.com`
   - DigitalOcean will verify and provision SSL automatically

---

## Step 5: Update SoundCloud OAuth Settings

1. **Go to SoundCloud Developer Dashboard**
   - Visit: https://developers.soundcloud.com/apps
   - Log in and select your app

2. **Update Redirect URI**
   - Find the **Redirect URI** field
   - Update it to: `https://api.soundcloudtoolkit.com/api/auth/callback`
   - Save changes

---

## Step 6: Update Frontend (if needed)

If your frontend is on Vercel or another platform:

1. **Update Frontend Environment Variables**
   - Go to your frontend hosting platform (Vercel, etc.)
   - Update `VITE_API_BASE` or equivalent to: `https://api.soundcloudtoolkit.com`
   - Redeploy your frontend

---

## Step 7: Test Everything

1. **Test Health Endpoint**
   ```
   https://api.soundcloudtoolkit.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Authentication Flow**
   - Go to your frontend
   - Try logging in with SoundCloud
   - Verify OAuth callback works

3. **Test API Endpoints**
   - Test a few API calls from your frontend
   - Check browser console for any CORS errors

---

## Step 8: Update Keep-Warm Workflow (Optional)

Since DigitalOcean keeps services running on paid plans, you can:

1. **Option A: Disable the workflow**
   - Go to `.github/workflows/keep-api-warm.yml`
   - Comment out the schedule section

2. **Option B: Update URL** (if you want to keep it for monitoring)
   - Update the URL in the workflow to: `https://api.soundcloudtoolkit.com/health`

---

## Step 9: Shut Down Render (After Testing)

Once everything is working on DigitalOcean:

1. **Go to Render Dashboard**
2. **Suspend or Delete** your old service
3. This frees up your Render free tier hours

---

## Troubleshooting

### Build Fails
- **Check logs** in DigitalOcean dashboard
- Verify `prisma:generate` runs successfully
- Ensure all dependencies are in `package.json`

### Domain Not Working
- **Check DNS propagation**: Use [dnschecker.org](https://dnschecker.org) to verify CNAME record
- **Wait longer**: DNS can take up to 48 hours (usually much faster)
- **Verify CNAME**: Make sure it points to your DigitalOcean app domain

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check Neon dashboard - ensure connection pooling is enabled
- For Neon, use the pooled connection string (ends with `?pgbouncer=true`)

### CORS Errors
- Verify `APP_URL` and `APP_URLS` include your frontend domain
- Check that `APP_URLS` includes `https://api.soundcloudtoolkit.com`
- Ensure frontend is using HTTPS

### SSL Certificate Issues
- DigitalOcean automatically provisions SSL via Let's Encrypt
- Wait 5-10 minutes after domain is verified
- Check domain status in DigitalOcean dashboard

### Health Check Fails
- Verify `/health` endpoint is accessible
- Check app logs in DigitalOcean dashboard
- Ensure app is running (not crashed)

---

## Cost Breakdown

- **Basic XXS**: $5/month
  - 512MB RAM
  - 1 vCPU
  - 1GB storage
  - Good for starting out

- **Upgrade if needed**:
  - Basic XS: $12/month (1GB RAM)
  - Basic S: $24/month (2GB RAM, 2 vCPU)

---

## Support Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Custom Domains Guide](https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/)
- [DigitalOcean Community](https://www.digitalocean.com/community)

---

## Quick Checklist

- [ ] Created DigitalOcean account
- [ ] Created app from GitHub repository
- [ ] Added all environment variables
- [ ] Deployed app successfully
- [ ] Added custom domain `api.soundcloudtoolkit.com`
- [ ] Added CNAME DNS record
- [ ] Waited for DNS propagation
- [ ] Updated SoundCloud OAuth redirect URI
- [ ] Updated frontend API URL
- [ ] Tested health endpoint
- [ ] Tested authentication flow
- [ ] Tested API endpoints
- [ ] Shut down Render service

---

**You're all set!** Your backend is now running on DigitalOcean with your custom domain. 🚀
