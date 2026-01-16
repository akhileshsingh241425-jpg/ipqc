#!/bin/bash
# Quick Fix for BOM Images on Hostinger Server
# Run this script on the Hostinger server after uploading updated .htaccess files

echo "=========================================="
echo "  FIXING UPLOADS ACCESS ON SERVER"
echo "=========================================="
echo ""

# Navigate to api folder
cd ~/public_html/api

# Create uploads folder structure
echo "Creating uploads folder structure..."
mkdir -p uploads/bom_materials
mkdir -p uploads/ipqc_pdfs
mkdir -p uploads/ftr_documents
mkdir -p uploads/ftr_reports
mkdir -p uploads/iv_graphs

# Set permissions
echo "Setting permissions..."
chmod 755 uploads
chmod 755 uploads/bom_materials
chmod 755 uploads/ipqc_pdfs
chmod 755 uploads/ftr_documents
chmod 755 uploads/ftr_reports
chmod 755 uploads/iv_graphs

# Create uploads/.htaccess if not exists
if [ ! -f "uploads/.htaccess" ]; then
    echo "Creating uploads/.htaccess..."
    cat > uploads/.htaccess << 'EOF'
# Allow direct access to uploaded files
Options -Indexes
Order allow,deny
Allow from all

# Set correct MIME types
<IfModule mod_mime.c>
    AddType image/jpeg .jpg .jpeg
    AddType image/png .png
    AddType image/gif .gif
    AddType application/pdf .pdf
</IfModule>

# CORS for uploaded files
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, OPTIONS"

# Cache control
<FilesMatch "\.(jpg|jpeg|png|gif|pdf)$">
    Header set Cache-Control "max-age=2592000, public"
</FilesMatch>
EOF
fi

# Set permissions for .htaccess
chmod 644 .htaccess
chmod 644 uploads/.htaccess

# Restart application
echo "Restarting application..."
touch tmp/restart.txt

echo ""
echo "=========================================="
echo "✓ Uploads access fixed!"
echo "=========================================="
echo ""
echo "Test URL: http://103.108.220.227/api/uploads/bom_materials/"
echo ""
echo "Next steps:"
echo "1. Upload a BOM image from frontend"
echo "2. Copy the image URL from response"
echo "3. Try opening it in browser"
echo ""
