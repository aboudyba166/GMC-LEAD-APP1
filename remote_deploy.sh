set -e
APP="~/lead-command-center"
ZIP="~/lead-command-center-hostinger.zip"
mkdir -p "$APP"
cd "$APP"
unzip -o "$ZIP"
echo "--- npm install ---"
npm install
echo "--- npm run build ---"
npm run build
echo "DEPLOY_COMPLETE"
