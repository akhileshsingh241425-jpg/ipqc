#!/bin/bash
# Nginx Configuration Update for Fast Image Serving
# Run this on server to update nginx config

echo "🔧 Updating Nginx Configuration..."

# Backup existing config
sudo cp /etc/nginx/sites-available/pdi /etc/nginx/sites-available/pdi.backup.$(date +%Y%m%d_%H%M%S)

# Copy new config (adjust paths as needed)
# Method 1: If you have the file on server
# sudo cp ~/ipqc/nginx.conf /etc/nginx/sites-available/pdi

# Method 2: Manual edit - add these location blocks BEFORE the /api block:

cat << 'EOF'

Add these location blocks to /etc/nginx/sites-available/pdi:

    # Uploaded files (BOM materials, IPQC PDFs, FTR documents) - DIRECT SERVE
    location /uploads/ {
        alias /root/ipqc/backend/uploads/;
        autoindex off;
        
        # Enable caching for images
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # Enable sendfile for faster serving
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        
        # CORS headers for images
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        
        # Image types
        types {
            image/jpeg jpg jpeg;
            image/png png;
            image/gif gif;
            image/webp webp;
            application/pdf pdf;
        }
    }

    # Generated PDFs - DIRECT SERVE
    location /generated_pdfs/ {
        alias /root/ipqc/backend/generated_pdfs/;
        autoindex off;
        
        # Cache PDFs for 7 days
        expires 7d;
        add_header Cache-Control "public";
        
        sendfile on;
        tcp_nopush on;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*";
        
        types {
            application/pdf pdf;
        }
    }

EOF

echo ""
echo "✅ After adding the config blocks, run:"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "⚡ This will make images load INSTANTLY!"
