#!/usr/bin/env bash
set -e

echo "=== Deploying IT Assets Management System ==="

# 1. Ensure build exists
if [ ! -d "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/frontend/dist/frontend/browser" ]; then
    echo "Building Angular production bundle..."
    cd "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/frontend"
    npm run build -- --base-href /it-asset/
fi

# 2. Copy Frontend build to Nginx web root
echo "Copying frontend files to /var/www/html/it-asset/..."
sudo rm -rf /var/www/html/it-asset/*
sudo cp -r "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/frontend/dist/frontend/browser/"* /var/www/html/it-asset/
sudo chown -R nginx:nginx /var/www/html/it-asset 2>/dev/null || sudo chown -R www-data:www-data /var/www/html/it-asset 2>/dev/null || true

# 3. Copy updated Nginx configuration
echo "Updating Nginx configuration..."
sudo cp "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/docs/nginx-sites.conf" /etc/nginx/conf.d/sites.conf

# 4. Test and reload Nginx
echo "Testing Nginx configuration..."
sudo nginx -t

echo "Reloading Nginx..."
sudo nginx -s reload || sudo systemctl reload nginx

# 5. Open HTTP and HTTPS ports in firewall if firewalld is active
if command -v firewall-cmd &> /dev/null; then
    echo "Configuring firewall for HTTP and HTTPS..."
    sudo firewall-cmd --add-service=http --permanent 2>/dev/null || sudo firewall-cmd --add-port=80/tcp --permanent 2>/dev/null || true
    sudo firewall-cmd --add-service=https --permanent 2>/dev/null || sudo firewall-cmd --add-port=443/tcp --permanent 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
fi

# 5. Restart PM2 backend if needed
echo "Ensuring backend is running in PM2..."
pm2 restart it-assets-backend || pm2 start "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/backend/dist/src/main.js" --name it-assets-backend

echo "=== Deployment Completed Successfully! ==="
echo "Access your app at: http://localhost/it-asset/ or http://$(hostname -I | awk '{print $1}')/it-asset/"
