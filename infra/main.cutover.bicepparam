// Cutover parameters. Apply only after DNS points at the app and the
// SoundCloud OAuth redirect URI has been changed; see MIGRATION.md work item 4.
// Secrets are NOT here:
// postgresAdminPassword and deployerObjectId come from the environment that
// infra/deploy.sh sets up. Cutover values live on prep/domain-switch.
using 'main.bicep'

param baseName = 'tracktoolkit'
param nodeEnv = 'production'
param growthAutocheck = false
param sessionCookieSameSite = 'lax'
param adminIds = '472267677'
param appUrl = 'https://tracktoolkit.com'
param appUrls = 'https://tracktoolkit.com'
param soundcloudRedirectUri = 'https://tracktoolkit.com/api/auth/callback'
param customHostnames = [
  'tracktoolkit.com'
  'www.tracktoolkit.com'
  'soundcloudtoolkit.com'
  'www.soundcloudtoolkit.com'
  'api.soundcloudtoolkit.com'
]
param legacyRedirectHosts = 'www.tracktoolkit.com,soundcloudtoolkit.com,www.soundcloudtoolkit.com,api.soundcloudtoolkit.com'

param postgresAdminPassword = readEnvironmentVariable('TT_PG_ADMIN_PASSWORD')
param deployerObjectId = readEnvironmentVariable('TT_DEPLOYER_OBJECT_ID')
param clientIp = readEnvironmentVariable('TT_CLIENT_IP', '')
