#!/bin/zsh
# One-shot host setup for an always-on Phone Farm Mac (tested plan for a Mac mini).
# Run from a graphical login session (Terminal.app), NOT over bare SSH — WDA signing
# needs the login keychain unlocked. Re-runnable; every step is idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"

step() { print -P "\n%F{cyan}==> $1%f"; }

step "Xcode"
if ! xcode-select -p 2>/dev/null | grep -q "Xcode.*\.app"; then
  XC=$(ls -d /Applications/Xcode*.app 2>/dev/null | head -1 || true)
  if [[ -z "$XC" ]]; then
    echo "Xcode is not installed. Install it from the App Store (or: mas install 497799835), then re-run."; exit 1
  fi
  sudo xcode-select -s "$XC/Contents/Developer"
  sudo xcodebuild -license accept
  xcodebuild -runFirstLaunch
fi
echo "Xcode: $(xcode-select -p)"

step "Homebrew packages"
command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }
brew list --formula node >/dev/null 2>&1 || brew install node
brew list --formula postgresql@15 >/dev/null 2>&1 || brew install postgresql@15
brew services start postgresql@15 >/dev/null
for i in {1..20}; do pg_isready -h 127.0.0.1 -q && break; sleep 1; done
node -v

step "npm dependencies + XCUITest driver"
npm install
[[ -d .appium2/node_modules/appium-xcuitest-driver ]] || npm run appium:install-driver

step ".env"
if [[ ! -f .env ]]; then
  TEAM=$(security find-identity -v -p codesigning | sed -n 's/.*Apple Development: .*(\([A-Z0-9]\{10\}\)).*/\1/p' | head -1)
  PW=$(openssl rand -hex 16)
  sed -e "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://phone_farm:${PW}@127.0.0.1:5432/phone_farm#" \
      -e "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=${PW}#" \
      -e "s#^XCODE_ORG_ID=.*#XCODE_ORG_ID=${TEAM:-replace-me}#" \
      -e "s#^WDA_BUNDLE_ID=.*#WDA_BUNDLE_ID=com.$(whoami).WebDriverAgentRunner#" .env.example > .env
  echo "XCODE_DEVELOPER_DIR=$(xcode-select -p)" >> .env
  chmod 600 .env
  echo "Wrote .env (team: ${TEAM:-NOT FOUND — set XCODE_ORG_ID manually})"
fi
set -a; source .env; set +a

step "PostgreSQL role + database"
PGBIN=/opt/homebrew/opt/postgresql@15/bin
$PGBIN/psql -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -qc \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='phone_farm') THEN CREATE ROLE phone_farm LOGIN PASSWORD '${POSTGRES_PASSWORD}'; ELSE ALTER ROLE phone_farm WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}'; END IF; END \$\$;"
$PGBIN/psql -h 127.0.0.1 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='phone_farm'" | grep -q 1 \
  || $PGBIN/createdb -h 127.0.0.1 -O phone_farm phone_farm
npm run db:migrate

step "Keep the host awake"
sudo pmset -a sleep 0 disksleep 0 displaysleep 0 autorestart 1 >/dev/null || true

step "launchd agents"
mkdir -p ~/Library/LaunchAgents "$REPO/logs"
for svc in appium wda-service worker web; do
  sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" -e "s#__NODE_BIN__#$(dirname "$(command -v node)")#g" \
      "deploy/launchd/com.phone-farm.$svc.plist" > ~/Library/LaunchAgents/com.phone-farm.$svc.plist
  launchctl bootout gui/$(id -u)/com.phone-farm.$svc 2>/dev/null || true
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.phone-farm.$svc.plist
done
sleep 5
curl -sf "http://127.0.0.1:${WEB_PORT:-3000}/health" && echo && echo "Dashboard: http://127.0.0.1:${WEB_PORT:-3000}"

cat <<MSG

Host is ready. Next, with the iPhone plugged in, unlocked, and trusted:
  npm run wda:prepare
then open the dashboard and click "Register device".
Logs: $REPO/logs/*.log   Restart a service: launchctl kickstart -k gui/$(id -u)/com.phone-farm.web
MSG
