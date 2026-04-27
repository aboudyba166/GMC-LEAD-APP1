set -e
mkdir -p ~/public_html/leads
cd ~/public_html/leads
unzip -o ~/deploy.zip -d .
rm -f ~/deploy.zip
echo "--- Installing Dependencies ---"
npm install
echo "--- Building Next.js ---"
npm run build
echo "--- Starting with PM2 ---"
npm install pm2 -g || true
pm2 delete leads-app || true
PORT=3000 NODE_ENV=production pm2 start npm --name "leads-app" -- start
pm2 save
echo "--- DEPLOYMENT SUCCESSFUL ---"
