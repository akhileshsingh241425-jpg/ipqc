#!/bin/bash
# Start PDI Application with PM2 on Hostinger/Linux

echo "========================================"
echo "  Starting PDI with PM2"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}[ERROR] PM2 not installed!${NC}"
    echo ""
    echo "Install PM2:"
    echo "  npm install -g pm2"
    echo "  # Or with sudo:"
    echo "  sudo npm install -g pm2"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if ecosystem config exists
if [ ! -f "ecosystem.config.js" ] && [ ! -f "ecosystem.hostinger.config.js" ]; then
    echo -e "${RED}[ERROR] PM2 config file not found!${NC}"
    exit 1
fi

# Choose config file
if [ -f "ecosystem.hostinger.config.js" ]; then
    CONFIG_FILE="ecosystem.hostinger.config.js"
else
    CONFIG_FILE="ecosystem.config.js"
fi

echo -e "${YELLOW}[1/3] Stopping existing PM2 processes...${NC}"
pm2 delete all 2>/dev/null

echo ""
echo -e "${YELLOW}[2/3] Starting applications with PM2...${NC}"
pm2 start "$CONFIG_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to start PM2 processes!${NC}"
    echo "Check logs: pm2 logs"
    exit 1
fi

echo ""
echo -e "${YELLOW}[3/3] Saving PM2 process list...${NC}"
pm2 save

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PM2 Started Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Applications running:"
pm2 status

echo ""
echo "Useful commands:"
echo "  pm2 status          - View status"
echo "  pm2 logs            - View logs"
echo "  pm2 monit           - Monitor in real-time"
echo "  pm2 restart all     - Restart all apps"
echo "  pm2 stop all        - Stop all apps"
echo ""
echo "Setup auto-start on reboot:"
echo "  pm2 startup"
echo "  (Follow the command it gives you)"
echo ""
