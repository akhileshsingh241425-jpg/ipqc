import sys
import os

# Python version and virtual environment path
# Update this path according to your Hostinger setup
INTERP = os.path.expanduser("~/virtualenv/pdi_backend/3.9/bin/python3")
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

# Add application to path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

# Create Flask application
from app import create_app
application = create_app()

# For debugging (remove in production)
if __name__ == '__main__':
    application.run()
