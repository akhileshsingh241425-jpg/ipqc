#!/bin/bash
# Port Availability Checker for Hostinger VPS

echo "=========================================="
echo "  PORT AVAILABILITY CHECKER"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports to check
PORTS=(80 443 3000 3001 5000 5001 5002 5003 8000 8080 8443 9000)

echo -e "${BLUE}Checking common ports...${NC}"
echo ""

FREE_PORTS=()
USED_PORTS=()

for PORT in "${PORTS[@]}"; do
    # Check if port is in use
    if sudo netstat -tlnp | grep -q ":$PORT "; then
        PROCESS=$(sudo netstat -tlnp | grep ":$PORT " | awk '{print $7}' | head -1)
        echo -e "${RED}✗ Port $PORT - IN USE${NC} ($PROCESS)"
        USED_PORTS+=($PORT)
    else
        echo -e "${GREEN}✓ Port $PORT - FREE${NC}"
        FREE_PORTS+=($PORT)
    fi
done

echo ""
echo "=========================================="
echo "  SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}FREE PORTS (${#FREE_PORTS[@]}):${NC}"
if [ ${#FREE_PORTS[@]} -eq 0 ]; then
    echo "  None of the common ports are free"
else
    for PORT in "${FREE_PORTS[@]}"; do
        echo "  - $PORT"
    done
fi

echo ""
echo -e "${RED}USED PORTS (${#USED_PORTS[@]}):${NC}"
if [ ${#USED_PORTS[@]} -eq 0 ]; then
    echo "  All checked ports are free!"
else
    for PORT in "${USED_PORTS[@]}"; do
        PROCESS=$(sudo netstat -tlnp | grep ":$PORT " | awk '{print $7}' | head -1)
        echo "  - $PORT ($PROCESS)"
    done
fi

echo ""
echo "=========================================="
echo "  RECOMMENDATIONS"
echo "=========================================="
echo ""

if [[ " ${FREE_PORTS[@]} " =~ " 5002 " ]]; then
    echo -e "${GREEN}✓ Port 5002 is FREE - Perfect for backend!${NC}"
elif [[ " ${FREE_PORTS[@]} " =~ " 5000 " ]]; then
    echo -e "${GREEN}✓ Port 5000 is FREE - Good for backend!${NC}"
elif [[ " ${FREE_PORTS[@]} " =~ " 8000 " ]]; then
    echo -e "${GREEN}✓ Port 8000 is FREE - Can use for backend!${NC}"
else
    echo -e "${YELLOW}⚠ Common backend ports are in use${NC}"
    echo "  Use any available port from free ports list above"
fi

echo ""
echo "For custom port check:"
echo "  sudo netstat -tlnp | grep :PORT_NUMBER"
echo ""
echo "To see all listening ports:"
echo "  sudo netstat -tlnp"
echo ""
