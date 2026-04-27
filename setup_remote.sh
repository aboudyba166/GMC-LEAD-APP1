set -e
cd ~/public_html/leads
echo "--- Installing PM2 ---"
npm install pm2 -g || npm install pm2 --prefix ~/.npm-global && export PATH=$PATH:~/.npm-global/bin
echo "--- Starting App with PM2 ---"
# We use a placeholder for the API key; user will need to update this one value
pm2 delete leads-app || true
PORT=3000 NODE_ENV=production pm2 start npm --name "leads-app" -- start
pm2 save
echo "--- Deployment Complete ---"
