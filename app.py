import os
import json
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_from_directory
from flask_socketio import SocketIO
import logging
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from functools import wraps

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
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', 
                   ping_timeout=5, ping_interval=25, reconnection=True,
                   reconnection_attempts=5, reconnection_delay=1)

# Import and initialize database
from models import db, Device, SensorData, UserAction, User, Home, Floor, Room, HomeAccess
db.init_app(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))
# Import and initialize MQTT client
from mqtt_client import MQTTClient
mqtt_client = MQTTClient()

def init_app():
    """Initialize database and MQTT client."""
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
        logger.info("Database tables created successfully")
        mqtt_client.init_app(app, socketio)
        # Add sample devices if none exist
        if Device.query.count() == 0:
            _add_sample_devices()

# Disable caching for development
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# Generate a secure token
def generate_token():
    return secrets.token_hex(16)

# Token authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check if token is in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
        # Check if token is in query parameters
        if not token and 'access_token' in request.args:
            token = request.args.get('access_token')
        if not token:
            return jsonify({
                'success': False,
                'message': 'Authentication token is missing'
            }), 401
        # Find user with this token
        user = User.query.filter_by(access_token=token).first()
        if not user or not user.token_expiry or user.token_expiry < datetime.now(timezone.utc):
            return jsonify({
                'success': False,
                'message': 'Invalid or expired token'
            }), 401
        # Token is valid, store user in flask.g for the duration of this request
        return f(user, *args, **kwargs)
    return decorated

# Routes
@app.route('/')
def index():
    """Render the home page."""
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = request.form.get('remember') == 'on'
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user, remember=remember)
            user.last_login = datetime.utcnow()
            # Generate access token for API usage
            user.access_token = generate_token()
            user.token_expiry = datetime.now(timezone.utc) + timedelta(days=7)  # Token valid for 7 days
            db.session.commit()
            next_page = request.args.get('next')
            if next_page and next_page.startswith('/'):
                return redirect(next_page)
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password', 'danger')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Handle user registration."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        first_name = request.form.get('first_name')
        last_name = request.form.get('last_name')
        # Check if passwords match
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('register.html')
        # Check if username or email already exists
        existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing_user:
            flash('Username or email already exists', 'danger')
            return render_template('register.html')
        # Create new user
        new_user = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    """Handle user logout."""
    if current_user.is_authenticated:
        # Invalidate the access token
        current_user.access_token = None
        current_user.token_expiry = None
        db.session.commit()
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    """Render the dashboard page."""
    with app.app_context():
        # Query devices with their relationships
        devices_query = (db.session.query(Device, Room, Floor)
                        .join(Room, Device.room_id == Room.id)
                        .join(Floor, Room.floor_id == Floor.id)
                        .filter(Device.is_active == True)
                        .all())
        # Format device data for the template
        devices_data = []
        for device, room, floor in devices_query:
            # Get the latest sensor data if applicable
            latest_data = None
            if device.type in ['temperature', 'humidity', 'light']:
                latest_data = SensorData.query.filter_by(device_id=device.id).order_by(SensorData.timestamp.desc()).first()
            device_info = device.to_dict()
            device_info.update({
                'location': room.name.lower().replace(' ', '_'),
                'room_name': room.name,
                'floor': floor.floor_number,
                'floor_name': floor.name,
                'last_seen': device.last_seen,
                'latest_value': latest_data.value if latest_data else None,
                'latest_timestamp': latest_data.timestamp if latest_data else None
            })
            devices_data.append(device_info)
        # Get floor statistics
        floors = Floor.query.order_by(Floor.floor_number).all()
        return render_template('dashboard.html', devices=devices_data, floors=floors)

@app.route('/devices')
@login_required
def devices():
    """Render the devices management page."""
    with app.app_context():
        all_devices = Device.query.all()
        return render_template('devices.html', devices=all_devices)

@app.route('/history')
@login_required
def history():
    """Render the data history page."""
    with app.app_context():
        devices = Device.query.all()
        return render_template('history.html', devices=devices)

@app.route('/floors')
@login_required
def floor_view():
    """Render the floor-based view page."""
    with app.app_context():
        # Get floor data with their rooms
        floors_data = get_floors_with_rooms()
        return render_template('floors.html', floors=floors_data)

@app.route('/room/<int:floor_id>/<int:room_id>')
@login_required
def room_view(floor_id, room_id):
    """Render the room view page for a specific room on a specific floor."""
    with app.app_context():
        room = db.session.get(Room, room_id)
        if not room or room.floor.id != floor_id:
            flash('Room not found', 'danger')
            return redirect(url_for('floor_view'))
        devices = Device.query.filter_by(room_id=room_id).all()
        return render_template('room.html', 
            floor=room.floor,
            floor_name=room.floor.name,
            room=room,
            devices=devices
        )

# API Routes
@app.route('/api/devices', methods=['GET'])
@token_required
def api_get_devices(user):
    """Get all devices for the authenticated user's homes."""
    with app.app_context():
        # Get homes that the user has access to
        if user.is_admin:
            homes = Home.query.all()
        else:
            # Get homes where user is owner or has access through HomeAccess
            homes = Home.query.filter(
                (Home.owner_id == user.id) | 
                (Home.id.in_([access.home_id for access in user.home_accesses]))
            ).all()
        # Get all accessible home IDs
        home_ids = [home.id for home in homes]
        # Get all floors in these homes
        floors = Floor.query.filter(Floor.home_id.in_(home_ids)).all()
        floor_ids = [floor.id for floor in floors]
        # Get all rooms in these floors
        rooms = Room.query.filter(Room.floor_id.in_(floor_ids)).all()
        room_ids = [room.id for room in rooms]
        # Get all devices in these rooms
        devices = Device.query.filter(Device.room_id.in_(room_ids)).all()
        return jsonify({
            'success': True,
            'devices': [device.to_dict() for device in devices]
        })

@app.route('/api/devices/<device_id>', methods=['GET'])
@token_required
def api_get_device(user, device_id):
    """Get device by ID if user has access to it."""
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return jsonify({
                'success': False,
                'message': 'Device not found'
            }), 404
        # Check if user has access to this device
        if not user_has_access_to_device(user, device):
            return jsonify({
                'success': False,
                'message': 'Access denied to this device'
            }), 403
        return jsonify({
            'success': True,
            'device': device.to_dict()
        })

@app.route('/api/devices', methods=['POST'])
@token_required
def api_add_device(user):
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
        # Get the room by ID
        room = db.session.get(Room, data.get('room_id'))
        if not room:
            return jsonify({
                'success': False,
                'message': 'Invalid room ID'
            }), 400
        # Check if user has access to this room's home
        floor = db.session.get(Floor, room.floor_id)
        if not floor:
            return jsonify({
                'success': False,
                'message': 'Invalid floor ID'
            }), 400
        home = db.session.get(Home, floor.home_id)
        if not home:
            return jsonify({
                'success': False,
                'message': 'Invalid home ID'
            }), 400
        # Check if user has access to add devices to this home
        if not (user.is_admin or home.owner_id == user.id or 
                any(access.home_id == home.id and access.access_level in ['owner', 'admin'] 
                    for access in user.home_accesses)):
            return jsonify({
                'success': False,
                'message': 'You do not have permission to add devices to this home'
            }), 403
        # Create new device
        new_device = Device(
            device_id=data.get('device_id'),
            name=data.get('name'),
            type=data.get('type'),
            room_id=data.get('room_id'),
            status='offline'
        )
        db.session.add(new_device)
        db.session.commit()
        return jsonify({
            'success': True,
            'device': new_device.to_dict()
        }), 201

@app.route('/api/devices/<device_id>', methods=['PUT'])
@token_required
def api_update_device(user, device_id):
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
        # Check if user has access to this device
        if not user_has_access_to_device(user, device):
            return jsonify({
                'success': False,
                'message': 'Access denied to this device'
            }), 403
        # Update device fields
        if 'name' in data:
            device.name = data['name']
        if 'room_id' in data:
            # Verify room exists and user has access
            room = db.session.get(Room, data['room_id'])
            if not room:
                return jsonify({
                    'success': False,
                    'message': 'Invalid room ID'
                }), 400
            # Check if user has access to the new room
            if not user_has_access_to_room(user, room):
                return jsonify({
                    'success': False,
                    'message': 'Access denied to the target room'
                }), 403
            device.room_id = data['room_id']
        if 'is_active' in data:
            device.is_active = data['is_active']
        db.session.commit()
        return jsonify({
            'success': True,
            'device': device.to_dict()
        })

@app.route('/api/devices/<device_id>', methods=['DELETE'])
@token_required
def api_delete_device(user, device_id):
    """Delete a device."""
    with app.app_context():
        device = Device.query.filter_by(device_id=device_id).first()
        if not device:
            return jsonify({
                'success': False,
                'message': 'Device not found'
            }), 404
        # Check if user has access to this device
        if not user_has_access_to_device(user, device):
            return jsonify({
                'success': False,
                'message': 'Access denied to this device'
            }), 403
        # Check if user has permission to delete devices
        room = db.session.get(Room, device.room_id)
        if room:
            floor = db.session.get(Floor, room.floor_id)
            if floor:
                home = db.session.get(Home, floor.home_id)
                if home:
                    # Only home owners and admins can delete devices
                    if not (user.is_admin or home.owner_id == user.id or 
                            any(access.home_id == home.id and access.access_level in ['owner', 'admin'] 
                                for access in user.home_accesses)):
                        return jsonify({
                            'success': False,
                            'message': 'You do not have permission to delete devices from this home'
                        }), 403
        db.session.delete(device)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Device deleted'
        })

@app.route('/api/devices/<device_id>/data', methods=['GET'])
@token_required
def api_get_device_data(user, device_id):
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
        # Check if user has access to this device
        if not user_has_access_to_device(user, device):
            return jsonify({
                'success': False,
                'message': 'Access denied to this device'
            }), 403
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

@app.route('/api/device_data/<sensor_type>', methods=['GET'])
def api_get_sensor_data(sensor_type):
    """Get sensor data by type."""
    device_id = request.args.get('device_id')
    days = request.args.get('days', 1, type=int)
    limit = request.args.get('limit', 100, type=int)
    if not device_id:
        return jsonify({
            'success': False,
            'message': 'Device ID is required'
        }), 400
    with app.app_context():
        # Create a mapping between frontend device IDs and database device IDs
        known_mappings = {
            'temp_living_room_f1': 'temperature_living_room_f1',
            'humidity_living_room_f1': 'humidity_living_room_f1'
        }
        # Use the mapped ID if available
        mapped_id = known_mappings.get(device_id, device_id)
        device = Device.query.filter_by(device_id=mapped_id).first()
        # If still not found, try additional fallback methods
        if not device and device_id.startswith('temp_'):
            # Try with 'temperature_' prefix
            corrected_id = device_id.replace('temp_', 'temperature_')
            device = Device.query.filter_by(device_id=corrected_id).first()
        if not device:
            # Try to find device by room name and sensor type
            parts = device_id.split('_')
            if len(parts) >= 3:
                # Extract room name and floor number
                if parts[0] in ['temp', 'temperature', 'humidity', 'light']:
                    room_parts = parts[1:-1]  # Middle parts are room name
                    floor_part = parts[-1]    # Last part is floor number
                    room_name = ' '.join(word.capitalize() for word in room_parts)
                    # Map sensor type if needed
                    if parts[0] == 'temp':
                        search_type = 'temperature'
                    else:  # humidity
                        search_type = parts[0]
                    # Find the room
                    room = Room.query.filter(Room.name.ilike(room_name)).first()
                    if room:
                        # Find device by room and type
                        device = Device.query.filter_by(
                            room_id=room.id, 
                            type=search_type
                        ).first()
        # If still not found, create a dummy response to prevent errors
        if not device:
            logger.warning(f"Device not found for ID: {device_id}, sensor type: {sensor_type}. Returning empty data.")
            return jsonify({
                'success': True,
                'device_id': device_id,
                'sensor_type': sensor_type,
                'data': []
            })
        # Log successful mapping if ID was different
        if device_id != device.device_id:
            logger.info(f"Mapped request {device_id} to device {device.device_id}")
        # Get sensor data for the specified time range
        since = datetime.utcnow() - timedelta(days=days)
        data = SensorData.query.filter_by(device_id=device.id)\
            .filter(SensorData.timestamp >= since)\
            .order_by(SensorData.timestamp.desc())\
            .limit(limit).all()
        return jsonify({
            'success': True,
            'device_id': device_id,
            'actual_device_id': device.device_id,
            'sensor_type': sensor_type,
            'data': [item.to_dict() for item in data]
        })

@app.route('/api/devices/<device_id>/control', methods=['POST'])
@token_required
def api_control_device(user, device_id):
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
        # Check if user has access to this device
        if not user_has_access_to_device(user, device):
            return jsonify({
                'success': False,
                'message': 'Access denied to this device'
            }), 403
        action = data['action']
        value = data.get('value')
        # Record user action
        user_action_data = {
            'device_id': device.id,
            'action': action,
            'value': str(value) if value is not None else None,
            'user_id': user.id
        }
        user_action = UserAction(**user_action_data)
        db.session.add(user_action)
        db.session.commit()
        # Get the room and floor for the MQTT topic
        room = device.room
        floor = room.floor
        # Publish control message to MQTT
        topic = f"home/{floor.name}/{room.name}/{device.type}/control"
        payload = {
            'action': action,
            'value': value
        }
        try:
            if mqtt_client and mqtt_client.publish(topic, payload):
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
                logger.error(f"Failed to publish MQTT message to {topic}")
                return jsonify({
                    'success': False,
                    'message': 'Failed to send command: MQTT publish failed'
                }), 500
        except Exception as e:
            # Update user action status
            user_action.status = 'failed'            
            db.session.commit()
            logger.error(f"Exception during MQTT publish: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Failed to send command: {str(e)}'
            }), 500

@app.route('/api/homes', methods=['GET'])
@token_required
def api_get_homes(user):
    """Get all homes and their floors."""
    with app.app_context():
        # Get homes that the user has access to
        if user.is_admin:
            homes = Home.query.all()
        else:
            # Get homes where user is owner or has access through HomeAccess
            homes = Home.query.filter(
                (Home.owner_id == user.id) | 
                (Home.id.in_([access.home_id for access in user.home_accesses]))
            ).all()
        return jsonify({
            'success': True,
            'homes': [home.to_dict() for home in homes]
        })

@app.route('/api/floors', methods=['GET'])
@token_required
def api_get_floors(user):
    """Get all floors and their rooms for a specific home."""
    home_id = request.args.get('home_id', type=int)
    with app.app_context():
        if not home_id:
            return jsonify({
                'success': False,
                'message': 'Home ID parameter required'
            }), 400
        # Check if user has access to this home
        home = db.session.get(Home, home_id)
        if not home:
            return jsonify({
                'success': False,
                'message': 'Home not found'
            }), 404
        # Check if user has access
        if not (user.is_admin or 
               home.owner_id == user.id or
               any(access.home_id == home_id for access in user.home_accesses)):
            return jsonify({
                'success': False,
                'message': 'Access denied to this home'
            }), 403
        # Get floors for this home
        floors = Floor.query.filter_by(home_id=home_id).order_by(Floor.floor_number).all()
        floors_data = []
        for floor in floors:
            rooms_data = []
            for room in floor.rooms:
                devices_count = Device.query.filter_by(room_id=room.id).count()
                rooms_data.append({
                    'id': room.id,
                    'name': room.name,
                    'room_type': room.room_type,
                    'device_count': devices_count
                })
            floors_data.append({
                'id': floor.id,
                'floor_number': floor.floor_number,
                'name': floor.name,
                'rooms': rooms_data
            })
        return jsonify({
            'success': True,
            'floors': floors_data
        })

@app.route('/api/validate-token', methods=['GET'])
def validate_token():
    """Validate authentication token."""
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({
            'valid': False,
            'message': 'No token provided'
        }), 401
    # Extract token
    token = auth_header[7:]  # Remove 'Bearer ' prefix
    # Find user with this token
    user = User.query.filter_by(access_token=token).first()
    # Check if token is valid
    if not user or not user.token_expiry or user.token_expiry < datetime.now(timezone.utc):
        return jsonify({
            'valid': False,
            'message': 'Invalid or expired token'
        }), 401
    # Token is valid
    return jsonify({
        'valid': True,
        'user_id': user.id,
        'username': user.username,
        'expires': user.token_expiry.isoformat() if user.token_expiry else None
    })

def get_floors_with_rooms():
    """Get detailed information about floors and their rooms."""
    floors_data = []
    # If user is authenticated, get homes they have access to
    if current_user.is_authenticated:
        if current_user.is_admin:
            homes = Home.query.all()
        else:
            homes = Home.query.filter(
                (Home.owner_id == current_user.id) | 
                (Home.id.in_([access.home_id for access in current_user.home_accesses]))
            ).all()
        for home in homes:
            for floor in home.floors:
                rooms_data = []
                for room in floor.rooms:
                    device_count = Device.query.filter_by(room_id=room.id).count()
                    rooms_data.append({
                        "id": room.id,
                        "name": room.name,
                        "room_type": room.room_type,
                        "device_count": device_count
                    })
                floors_data.append({
                    "id": floor.id,
                    "floor_number": floor.floor_number,
                    "name": floor.name or f"Floor {floor.floor_number}",
                    "home_name": home.name,
                    "home_id": home.id,
                    "rooms": rooms_data
                })
    return floors_data

# Helper functions for access control
def user_has_access_to_device(user, device):
    """Check if user has access to a device."""
    if user.is_admin:  # Admin has access to all devices
        return True
    # Get the room, floor, and home for this device
    room = db.session.get(Room, device.room_id)
    if not room:
        return False
    floor = db.session.get(Floor, room.floor_id)
    if not floor:
        return False
    home = db.session.get(Home, floor.home_id)
    if not home:
        return False
    # Check if user is home owner or has access through HomeAccess
    if home.owner_id == user.id:
        return True
    user_access = HomeAccess.query.filter_by(home_id=home.id, user_id=user.id).first()
    if user_access:
        return True
    return False

def user_has_access_to_room(user, room):
    """Check if user has access to a room."""
    if user.is_admin:  # Admin has access to all rooms
        return True
    # Get the floor and home for this room
    floor = db.session.get(Floor, room.floor_id)
    if not floor:
        return False
    home = db.session.get(Home, floor.home_id)
    if not home:
        return False
    # Check if user is home owner or has access through HomeAccess
    if home.owner_id == user.id:
        return True
    user_access = HomeAccess.query.filter_by(home_id=home.id, user_id=user.id).first()
    if user_access:
        return True
    return False

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    """Handle client connection with authentication."""
    # Get auth token from request
    auth = request.args.get('token')
    
    # No authentication needed for normal web browser sessions
    # This prevents reconnection loops on the dashboard
    if not auth and request.headers.get('User-Agent') and 'Mozilla' in request.headers.get('User-Agent'):
        logger.info("Browser client connected - skipping token verification")
        return True
    
    # If authentication token is provided, verify it
    if auth:
        user = User.query.filter_by(access_token=auth).first()
        if not user or not user.token_expiry or user.token_expiry < datetime.now(timezone.utc):
            logger.warning(f"Client connection attempt with invalid token: {auth}")
            return False  # Reject connection with invalid token
        
        logger.info(f"Client authenticated as {user.username}")
    
    return True  # Allow connection

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    logger.info('Client disconnected')

@socketio.on('ping')
def handle_ping():
    """Handle ping from client (custom heartbeat)."""
    socketio.emit('pong')
    return True

def _add_sample_devices():
    """Add sample devices to the database."""
    # First check if we have any users
    admin_user = User.query.filter_by(is_admin=True).first()
    if not admin_user:
        # Create an admin user
        admin = User(
            username="admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="User",
            is_admin=True
        )
        admin.set_password("admin123")  # You should change this in production
        db.session.add(admin)
        db.session.commit()
        admin_user = admin
    
    # Create a sample home if none exists
    home = Home.query.first()
    if not home:
        home = Home(
            name="My Smart Home",
            address="123 Smart St, Tech City",
            owner_id=admin_user.id
        )
        db.session.add(home)
        db.session.commit()
    
    # Add floors if they don't exist
    floor_names = {
        1: "Ground Floor",
        2: "First Floor",
        3: "Second Floor"
    }
    
    floors = {}
    for floor_num, floor_name in floor_names.items():
        floor = Floor.query.filter_by(home_id=home.id, floor_number=floor_num).first()
        if not floor:
            floor = Floor(
                home_id=home.id,
                floor_number=floor_num,
                name=floor_name
            )
            db.session.add(floor)
            db.session.commit()
        floors[floor_num] = floor
    
    # Define room types for each floor
    room_types = {
        1: [  # Ground Floor
            {"name": "Living Room", "type": "living"},
            {"name": "Kitchen", "type": "kitchen"},
            {"name": "Dining Room", "type": "dining"},
            {"name": "Office", "type": "office"}
        ],
        2: [  # First Floor
            {"name": "Master Bedroom", "type": "bedroom"},
            {"name": "Guest Bedroom", "type": "bedroom"},
            {"name": "Bathroom", "type": "bathroom"},
            {"name": "Hallway", "type": "hallway"}
        ],
        3: [  # Second Floor
            {"name": "Game Room", "type": "entertainment"},
            {"name": "Gym", "type": "fitness"},
            {"name": "Home Theater", "type": "entertainment"}
        ]
    }
    
    # Create rooms for each floor
    rooms = {}
    for floor_num, room_list in room_types.items():
        floor = floors[floor_num]
        floor_rooms = []
        for room_data in room_list:
            room = Room.query.filter_by(
                floor_id=floor.id, 
                name=room_data["name"]
            ).first()
            if not room:
                room = Room(
                    floor_id=floor.id,
                    name=room_data["name"],
                    room_type=room_data["type"]
                )
                db.session.add(room)
                db.session.commit()
            floor_rooms.append(room)
        rooms[floor_num] = floor_rooms
    
    # Now we can create sample devices in each room
    sample_device_types = {
        "living": ["temperature", "humidity", "light"],
        "kitchen": ["temperature", "humidity", "light"],
        "dining": ["light"],
        "office": ["temperature", "light"],
        "bedroom": ["temperature", "humidity", "light"],
        "bathroom": ["humidity", "light"],
        "hallway": ["light"],
        "entertainment": ["temperature", "light"],
        "fitness": ["temperature", "humidity", "light"]
    }
    
    for floor_num, floor_rooms in rooms.items():
        for room in floor_rooms:
            # Get device types for this room type
            device_types = sample_device_types.get(room.room_type, ["light"])
            for device_type in device_types:
                device_id = f"{device_type}_{room.name.lower().replace(' ', '_')}_f{floor_num}"
                # For Living Room on Floor 1, add special compatibility with frontend
                if room.name == "Living Room" and floor_num == 1:
                    if device_type == "temperature":
                        # Make sure both device IDs work
                        device_ids = [device_id]
                        alt_id = f"temp_{room.name.lower().replace(' ', '_')}_f{floor_num}"
                        # Check if alt ID already exists
                        if not Device.query.filter_by(device_id=alt_id).first():
                            device_ids.append(alt_id)
                    else:
                        device_ids = [device_id]
                else:
                    device_ids = [device_id]
                
                for current_id in device_ids:
                    # Check if device already exists
                    device = Device.query.filter_by(device_id=current_id).first()
                    if not device:
                        device = Device(
                            device_id=current_id,
                            name=f"{room.name} {device_type.capitalize()}",
                            type=device_type,
                            room_id=room.id,
                            status='offline'
                        )
                        db.session.add(device)
                
                # Add some sample sensor data for testing
                if device_type in ["temperature", "humidity"]:
                    main_device = Device.query.filter_by(device_id=device_id).first()
                    if main_device and SensorData.query.filter_by(device_id=main_device.id).count() == 0:
                        # Add 24 hours of sample data
                        now = datetime.utcnow()
                        for i in range(24):
                            timestamp = now - timedelta(hours=i)
                            if device_type == "temperature":
                                # Random temperature between 18 and 25
                                value = 18 + (i % 7) + round(random.random(), 1)
                            else:  # humidity
                                # Random humidity between 30 and 65
                                value = 30 + (i % 35) + round(random.random(), 1)
                            data = SensorData(
                                device_id=main_device.id,
                                value=value,
                                timestamp=timestamp
                            )
                            db.session.add(data)
    db.session.commit()
    logger.info("Sample devices and data added successfully")

# Add the missing import at the top of the file
import random

# Run the application
if __name__ == '__main__':
    init_app()
    socketio.run(app, debug=app.config['DEBUG'])