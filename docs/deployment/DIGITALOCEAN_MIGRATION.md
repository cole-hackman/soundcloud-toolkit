# DigitalOcean Migration Guide

This guide will help you migrate your backend from Render to DigitalOcean App Platform.

## Prerequisites

1. **DigitalOcean Account**: Sign up at [digitalocean.com](https://www.digitalocean.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Database**: Your PostgreSQL database (Neon or other) - keep this as-is, no migration needed

## Step 1: Create App on DigitalOcean

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Connect your GitHub account and select your repository
4. DigitalOcean will auto-detect the `.do/app.yaml` file

## Step 2: Configure Environment Variables

In the DigitalOcean dashboard, add these environment variables:

### Required Variables

```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgres://... (your existing Neon database URL)
SOUNDCLOUD_CLIENT_ID=your_client_id
SOUNDCLOUD_CLIENT_SECRET=your_client_secret
SOUNDCLOUD_REDIRECT_URI=https://your-api-domain.com/api/auth/callback
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_32_character_encryption_key
APP_URL=https://your-frontend-domain.com
APP_URLS=https://your-frontend-domain.com,https://your-api-domain.com
```

**Note**: Copy these from your Render environment variables.

## Step 3: Update SoundCloud OAuth Redirect URI

1. Go to your SoundCloud app settings
2. Update the redirect URI to match your new DigitalOcean domain:
   - Old: `https://your-render-domain.onrender.com/api/auth/callback`
   - New: `https://your-app-name.ondigitalocean.app/api/auth/callback`

## Step 4: Update Frontend API URL

If your frontend is on Vercel or another platform:

1. Update the `VITE_API_BASE` environment variable to your new DigitalOcean URL
2. Redeploy your frontend

## Step 5: Custom Domain (Optional)

1. In DigitalOcean App Platform, go to **Settings** → **Domains**
2. Add your custom domain (e.g., `api.yourdomain.com`)
3. Update DNS records as instructed
4. Update `SOUNDCLOUD_REDIRECT_URI` and `APP_URLS` to use the custom domain

## Step 6: Disable Keep-Warm Workflow

Since DigitalOcean App Platform keeps services running (on paid plans), you can:

1. **Option A**: Disable the GitHub Actions workflow
   - Go to `.github/workflows/keep-api-warm.yml`
   - Comment out or delete the file

2. **Option B**: Update it to ping your new DigitalOcean URL
   - Change the URL in the workflow file

## Step 7: Test & Verify

1. Deploy the app on DigitalOcean
2. Test the health endpoint: `https://your-app.ondigitalocean.app/health`
3. Test authentication flow
4. Test API endpoints

## Step 8: Update DNS (if using custom domain)

If you're using a custom domain:
- Update your DNS records to point to DigitalOcean
- Wait for DNS propagation (can take up to 48 hours, usually much faster)

## Step 9: Shut Down Render Service

Once everything is working:
1. Go to Render dashboard
2. Delete or suspend your old service
3. This will free up your Render free tier hours

## Pricing

- **Basic XXS**: $5/month (512MB RAM, 1 vCPU) - good for starting
- **Basic XS**: $12/month (1GB RAM, 1 vCPU) - if you need more resources
- **Basic S**: $24/month (2GB RAM, 2 vCPU) - for higher traffic

DigitalOcean App Platform includes:
- Automatic HTTPS
- Auto-scaling (if configured)
- Built-in monitoring
- Log aggregation
- Zero-downtime deployments

## Troubleshooting

### Build Fails
- Check that `prisma:generate` runs successfully
- Verify all dependencies are in `package.json`

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check that your database allows connections from DigitalOcean IPs
- For Neon, ensure connection pooling is enabled

### CORS Errors
- Verify `APP_URL` and `APP_URLS` environment variables are correct
- Check that your frontend domain is included in `APP_URLS`

### Health Check Fails
- Ensure `/health` endpoint is accessible
- Check logs in DigitalOcean dashboard

## Support

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [DigitalOcean Community](https://www.digitalocean.com/community)
