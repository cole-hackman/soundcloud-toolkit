#!/usr/bin/env bash
# Deploys infra/main.bicep into the resource group and writes the secrets the
# web app reads through Key Vault references.
#
# Usage:
#   TT_PG_ADMIN_PASSWORD='<strong password>' infra/deploy.sh
#   TT_PARAMS=infra/main.cutover.bicepparam ... infra/deploy.sh   # domain cutover values
#
# Idempotent: re-running updates in place. Secrets are only (re)written when
# the matching TT_SECRET_* variable is set, so a plain re-run never clobbers
# what is already in the vault.
#
# Secret names (the contract between this script and main.bicep appSettings):
#   database-url              Postgres connection string the app uses
#   encryption-key            32 chars, AES-256-GCM key for tokens.encrypted/refresh
#                             MUST be byte-identical to the DigitalOcean value
#   session-secret            >=32 chars, HMAC key for the session cookie
#                             MUST be byte-identical to the DigitalOcean value
#   soundcloud-client-id      OAuth client id
#   soundcloud-client-secret  OAuth client secret
#   download-allowlist        Comma-separated user ids allowed to proxy downloads
#   postgres-admin-password   Server admin password (operator use only)
set -euo pipefail

RG="${TT_RESOURCE_GROUP:-rg-tracktoolkit}"
LOCATION="${TT_LOCATION:-westus3}"
BASE="${TT_BASE_NAME:-tracktoolkit}"
KV="${BASE}-kv"
HERE="$(cd "$(dirname "$0")" && pwd)"

: "${TT_PG_ADMIN_PASSWORD:?set TT_PG_ADMIN_PASSWORD (or read it from Key Vault secret postgres-admin-password)}"
export TT_PG_ADMIN_PASSWORD
export TT_DEPLOYER_OBJECT_ID="${TT_DEPLOYER_OBJECT_ID:-$(az ad signed-in-user show --query id -o tsv)}"
export TT_CLIENT_IP="${TT_CLIENT_IP:-}"
# ARM rejects a second role assignment for the same principal/role/scope even
# under a different name, so skip ours if one is already there (portal grant).
# A preset TT_ASSIGN_DEPLOYER_ROLE wins over detection.
if [ -z "${TT_ASSIGN_DEPLOYER_ROLE:-}" ]; then
  KV_ID="/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV"
  if [ -n "$(az role assignment list --assignee "$TT_DEPLOYER_OBJECT_ID" --scope "$KV_ID" --role 'Key Vault Secrets Officer' --query '[0].id' -o tsv 2>/dev/null)" ]; then
    TT_ASSIGN_DEPLOYER_ROLE=false
  else
    TT_ASSIGN_DEPLOYER_ROLE=true
  fi
fi
export TT_ASSIGN_DEPLOYER_ROLE

az group create --name "$RG" --location "$LOCATION" --output none
az deployment group create \
  --name "tracktoolkit-$(date +%Y%m%d%H%M%S)" \
  --resource-group "$RG" \
  --template-file "$HERE/main.bicep" \
  --parameters "${TT_PARAMS:-$HERE/main.bicepparam}" \
  --output table

put_secret() { # name, value
  [ -n "${2:-}" ] || return 0
  # The Secrets Officer role assignment above can take a minute to propagate
  # on a fresh vault, so tolerate a few 403s.
  for attempt in 1 2 3 4 5 6; do
    if az keyvault secret set --vault-name "$KV" --name "$1" --value "$2" --output none 2>/dev/null; then
      echo "secret written: $1"; return 0
    fi
    echo "secret $1: not yet writable (attempt $attempt), waiting 20s"; sleep 20
  done
  echo "secret $1: giving up" >&2; return 1
}
put_secret postgres-admin-password "$TT_PG_ADMIN_PASSWORD"
put_secret database-url             "${TT_SECRET_DATABASE_URL:-}"
put_secret encryption-key           "${TT_SECRET_ENCRYPTION_KEY:-}"
put_secret session-secret           "${TT_SECRET_SESSION_SECRET:-}"
put_secret soundcloud-client-id     "${TT_SECRET_SOUNDCLOUD_CLIENT_ID:-}"
put_secret soundcloud-client-secret "${TT_SECRET_SOUNDCLOUD_CLIENT_SECRET:-}"
put_secret download-allowlist       "${TT_SECRET_DOWNLOAD_ALLOWLIST:-}"

# Key Vault references are re-resolved on an app-settings change, NOT on a
# plain restart (observed 2026-09-20: a restart after writing the secrets left
# every reference at SecretNotFound). Touch one setting to force it; the
# platform recreates the container with the resolved values.
az webapp config appsettings set --name "$BASE" --resource-group "$RG" \
  --settings "KV_RESOLVE_NUDGE=$(date +%s)" --output none
echo "done: https://${BASE}.azurewebsites.net/health"
