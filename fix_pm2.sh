set -e
echo "--- Cleaning Database ---"
rm -f ~/public_html/leads/data/leads.db

echo "--- Fixing PM2 Path ---"
# Try to find where pm2 is installed or install it locally if missing
if ! command -v pm2 &> /dev/null; then
    npm install pm2 -g || npm install pm2 --prefix=$HOME/.npm-global
    export PATH=$PATH:$HOME/.npm-global/bin
    echo "export PATH=\$PATH:\$HOME/.npm-global/bin" >> ~/.bashrc
fi

echo "--- Restarting App ---"
cd ~/public_html/leads
pm2 restart leads-app || pm2 start npm --name "leads-app" -- start
