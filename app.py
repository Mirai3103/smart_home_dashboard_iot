import os
import json
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO
import logging

# Import configuration
from config import Config

# Create Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('smart_home')

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Import and initialize database
from models import db, Device, SensorData, UserAction
db.init_app(app)

# Import and initialize MQTT client
from mqtt_client import MQTTClient
mqtt_client = MQTTClient()

def init_app():
    """Initialize database and MQTT client."""
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
        mqtt_client.init_app(app, socketio)
        # Add sample devices if none exist
        if Device.query.count() == 0:
            _add_sample_devices()

# Routes
@app.route('/')
def index():
    """Render the home page."""
    return render_template('index.html')


@app.route('/dashboard')
def dashboard():
    """Render the dashboard page."""
    with app.app_context():
        devices = Device.query.all()
        return render_template('dashboard.html', devices=devices)


@app.route('/devices')
def devices():
    """Render the devices management page."""
    with app.app_context():
        all_devices = Device.query.all()
        return render_template('devices.html', devices=all_devices)


@app.route('/history')
def history():
    """Render the data history page."""
    with app.app_context():
        devices = Device.query.all()
        return render_template('history.html', devices=devices)


# API Routes
@app.route('/api/devices', methods=['GET'])
def api_get_devices():
    """Get all devices."""
    with app.app_context():
        devices = Device.query.all()
        return jsonify({
            'success': True,
            'devices': [device.to_dict() for device in devices]
        })


@app.route('/api/devices/<device_id>', methods=['GET'])
def api_get_device(device_id):
    """Get device by ID."""
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if device:
            return jsonify({
                'success': True,
                'device': device.to_dict()
            })
        return jsonify({
            'success': False,
            'message': 'Device not found'
        }), 404


@app.route('/api/devices', methods=['POST'])
def api_add_device():
    """Add a new device."""
    data = request.json
    if not data:
        return jsonify({
            'success': False,
            'message': 'No data provided'
        }), 400
    
    with app.app_context():
        # Check if device already exists
        existing = Device.query.filter_by(device_id=data.get('device_id')).first()
        if existing:
            return jsonify({
                'success': False,
                'message': 'Device already exists'
            }), 400
        
        # Create new device
        new_device = Device(
            device_id=data.get('device_id'),
            name=data.get('name'),
            type=data.get('type'),
            location=data.get('location'),
            status='offline'
        )
        db.session.add(new_device)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'device': new_device.to_dict()
        }), 201


@app.route('/api/devices/<device_id>', methods=['PUT'])
def api_update_device(device_id):
    """Update a device."""
    data = request.json
    if not data:
        return jsonify({
            'success': False,
            'message': 'No data provided'
        }), 400
    
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return jsonify({
                'success': False,
                'message': 'Device not found'
            }), 404
        
        # Update device fields
        if 'name' in data:
            device.name = data['name']
        if 'location' in data:
            device.location = data['location']
        if 'is_active' in data:
            device.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'device': device.to_dict()
        })


@app.route('/api/devices/<device_id>', methods=['DELETE'])
def api_delete_device(device_id):
    """Delete a device."""
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return jsonify({
                'success': False,
                'message': 'Device not found'
            }), 404
        
        db.session.delete(device)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Device deleted'
        })


@app.route('/api/devices/<device_id>/data', methods=['GET'])
def api_get_device_data(device_id):
    """Get sensor data for a device."""
    days = request.args.get('days', 1, type=int)
    limit = request.args.get('limit', 100, type=int)
    
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return jsonify({
                'success': False,
                'message': 'Device not found'
            }), 404
        
        # Get sensor data for the specified time range
        since = datetime.utcnow() - timedelta(days=days)
        data = SensorData.query.filter_by(device_id=device.id)\
            .filter(SensorData.timestamp >= since)\
            .order_by(SensorData.timestamp.desc())\
            .limit(limit).all()
        
        return jsonify({
            'success': True,
            'device_id': device_id,
            'data': [item.to_dict() for item in data]
        })


@app.route('/api/devices/<device_id>/control', methods=['POST'])
def api_control_device(device_id):
    """Control a device."""
    data = request.json
    if not data or 'action' not in data:
        return jsonify({
            'success': False,
            'message': 'Invalid request. Action required.'
        }), 400
    
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return jsonify({
                'success': False,
                'message': 'Device not found'
            }), 404
        
        action = data['action']
        value = data.get('value')
        
        # Record user action
        user_action = UserAction(
            device_id=device.id,
            action=action,
            value=str(value) if value is not None else None
        )
        db.session.add(user_action)
        db.session.commit()
        
        # Publish control message to MQTT
        topic = f"home/{device.location}/{device.type}/control"
        payload = {
            'action': action,
            'value': value
        }
        
        if mqtt_client.publish(topic, payload):
            # Update user action status
            user_action.status = 'success'
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Command sent: {action}',
                'action_id': user_action.id
            })
        else:
            # Update user action status
            user_action.status = 'failed'
            db.session.commit()
            
            return jsonify({
                'success': False,
                'message': 'Failed to send command'
            }), 500


# Socket.IO events
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    logger.info('Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    logger.info('Client disconnected')


def _add_sample_devices():
    """Add sample devices to the database."""
    sample_devices = [
        {
            'device_id': 'temp_living_room',
            'name': 'Living Room Temperature',
            'type': 'temperature',
            'location': 'living_room',
            'status': 'offline'
        },
        {
            'device_id': 'humidity_living_room',
            'name': 'Living Room Humidity',
            'type': 'humidity',
            'location': 'living_room',
            'status': 'offline'
        },
        {
            'device_id': 'temp_bedroom',
            'name': 'Bedroom Temperature',
            'type': 'temperature',
            'location': 'bedroom',
            'status': 'offline'
        },
        {
            'device_id': 'humidity_bedroom',
            'name': 'Bedroom Humidity',
            'type': 'humidity',
            'location': 'bedroom',
            'status': 'offline'
        },
        {
            'device_id': 'light_living_room',
            'name': 'Living Room Light',
            'type': 'light',
            'location': 'living_room',
            'status': 'offline'
        },
        {
            'device_id': 'light_bedroom',
            'name': 'Bedroom Light',
            'type': 'light',
            'location': 'bedroom',
            'status': 'offline'
        }
    ]
    
    for device_data in sample_devices:
        device = Device(**device_data)
        db.session.add(device)
    
    db.session.commit()
    logger.info(f"Added {len(sample_devices)} sample devices")


# Run the application
if __name__ == '__main__':
    init_app()
    socketio.run(app, debug=app.config['DEBUG'])