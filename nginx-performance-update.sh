#!/bin/bash
# Quick Performance Optimization Script for CallNexa/CALLOS
# Run this on your server to apply immediate performance improvements

echo "🚀 Applying CallNexa Performance Optimizations..."

# Backup existing nginx config
sudo cp /etc/nginx/sites-enabled/api.callingos.tzmicha.com /etc/nginx/sites-enabled/api.callingos.tzmicha.com.backup
echo "✅ Backed up nginx config"

# Update nginx config with performance optimizations
sudo tee /etc/nginx/sites-enabled/api.callingos.tzmicha.com > /dev/null <<'EOF'
server {
    listen 443 ssl http2;
    server_name api.callingos.tzmicha.com;
    
    ssl_certificate /etc/letsencrypt/live/api.callingos.tzmicha.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.callingos.tzmicha.com/privkey.pem;
    
    # Enable compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_disable "msie6";
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Long timeouts for WebSocket
        proxy_read_timeout 86400;
        proxy_connect_timeout 86400;
        proxy_send_timeout 86400;
        
        # Disable buffering for real-time data
        proxy_buffering off;
        
        # Add caching headers for API responses (client-side)
        add_header Cache-Control "no-cache, must-revalidate" always;
    }
    
    # Static file caching (if serving any)
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff2|woff|ttf|eot)$ {
        proxy_pass http://localhost:8001;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, immutable";
        expires 30d;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.callingos.tzmicha.com;
    return 301 https://$server_name$request_uri;
}
EOF

echo "✅ Updated nginx config with compression and HTTP/2"

# Test nginx configuration
sudo nginx -t
if [ $? -eq 0 ]; then
    echo "✅ nginx config test passed"
    
    # Reload nginx
    sudo systemctl reload nginx
    echo "✅ nginx reloaded successfully"
    echo ""
    echo "🎉 Performance optimizations applied!"
    echo ""
    echo "Test the changes:"
    echo "  curl -H 'Accept-Encoding: gzip' -I https://api.callingos.tzmicha.com/health"
    echo "  curl -I --http2 https://api.callingos.tzmicha.com/health"
else
    echo "❌ nginx config test failed - restoring backup"
    sudo cp /etc/nginx/sites-enabled/api.callingos.tzmicha.com.backup /etc/nginx/sites-enabled/api.callingos.tzmicha.com
    sudo nginx -t
fi
