"""
IPQC Automation System - Flask Backend
Main application entry point (DEVELOPMENT MODE)

For PRODUCTION deployment, use production_server.py instead
"""
from app import create_app
import os
import socket

def find_free_port(start_port=5000, max_port=5100):
    """Find a free port to run the server"""
    for port in range(start_port, max_port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    return None

app = create_app()

if __name__ == '__main__':
    print("=" * 60)
    print("🔧 PDI Complete System - DEVELOPMENT Server")
    print("=" * 60)
    print("⚠️  This is DEVELOPMENT mode with auto-reload enabled")
    print("📝 For PRODUCTION, use: python production_server.py")
    print("=" * 60)
    
    # Hardcoded port for production deployment
    port = 5003
    print(f"✅ Running on FIXED PORT: {port}")
    
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=True, reloader_type='stat')
