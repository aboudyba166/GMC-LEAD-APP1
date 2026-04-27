set -e
export PATH=$PATH:$HOME/.npm-global/bin
echo "--- SYSTEM CHECK ---"
whoami
pwd
node -v
npm -v

echo "--- PORT CHECK ---"
netstat -tuln | grep :3000 || echo "Port 3000 is FREE"

echo "--- PM2 LOGS ---"
pm2 logs leads-app --lines 50 --no-colors || echo "No PM2 logs found"

echo "--- MANUAL START TEST ---"
cd ~/public_html/leads
# Try running it directly for 5 seconds to see the error
timeout 5s npm start || echo "Manual start finished/failed"
