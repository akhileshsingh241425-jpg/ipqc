#!/bin/bash
# Deploy BOM Supplier Dropdown Fix

echo "🔄 Pulling latest code from GitHub..."
cd ~/ipqc
git pull origin main

echo "📦 Building frontend with supplier dropdown fix..."
cd frontend
npm run build

echo "🔄 Restarting PM2 processes..."
cd ..
pm2 restart all

echo "✅ Deployment complete! Check browser now."
pm2 status
