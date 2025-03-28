#!/usr/bin/env python
"""
Entry point for the smart home dashboard application
with proper server setup
"""

import os
import sys
from app import app

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    
    print(f"Starting server on {host}:{port} (debug={debug})")
    app.run(
        host=host, 
        port=port, 
        debug=debug,
        use_reloader=debug
    )
