"""
Production Server for PDI Complete System
Uses Waitress WSGI server for production deployment
"""

from waitress import serve
from app import create_app

app = create_app()

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 PDI Complete System - Production Server")
    print("=" * 60)
    print("Server starting on http://0.0.0.0:5003")
    print("Press CTRL+C to stop the server")
    print("=" * 60)
    
    # Waitress production server
    # threads=4 for handling multiple concurrent requests
    serve(app, host='0.0.0.0', port=5003, threads=4)
