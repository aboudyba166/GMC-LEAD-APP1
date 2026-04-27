set -e
echo "--- Checking PM2 Status ---"
if command -v pm2 &> /dev/null; then
    pm2 status
    echo "--- PM2 Logs (last 20 lines) ---"
    pm2 logs leads-app --lines 20 --no-colors
else
    echo "PM2 not found. Checking if process is running on port 3000..."
    netstat -tuln | grep :3000 || echo "Nothing running on port 3000"
fi
