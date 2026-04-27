set -e
echo "--- Hard Cleaning Remote Server ---"
cd ~/public_html/leads
# Fix PM2 path if needed
export PATH=$PATH:$HOME/.npm-global/bin
pm2 stop leads-app || true
rm -rf .next
rm -rf node_modules/.cache
echo "--- Rebuilding on Server ---"
npm run build
echo "--- Restarting PM2 ---"
pm2 restart leads-app || pm2 start npm --name "leads-app" -- start
echo "--- REMOTE CLEAN COMPLETE ---"
