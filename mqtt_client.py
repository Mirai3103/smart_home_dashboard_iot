import json
import logging
import paho.mqtt.client as mqtt
from datetime import datetime

class MQTTClient:
    def __init__(self, app=None, socketio=None):
        self.client = None
        self.app = app
        self.socketio = socketio
        self.is_connected = False
        self.logger = logging.getLogger('mqtt_client')
        
        if app is not None and socketio is not None:
            self.init_app(app, socketio)

    def init_app(self, app, socketio):
        """Initialize the MQTT client with application settings."""
        self.app = app
        self.socketio = socketio
        
        # Setup client
        client_id = app.config['MQTT_CLIENT_ID']
        self.client = mqtt.Client(client_id=client_id)
        
        # Set authentication if provided
        if app.config.get('MQTT_USERNAME') and app.config.get('MQTT_PASSWORD'):
            self.client.username_pw_set(
                app.config['MQTT_USERNAME'],
                app.config['MQTT_PASSWORD']
            )
        
        # Setup callbacks
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        
        # Connect to broker
        self.connect()
        
    def connect(self):
        """Connect to the MQTT broker."""
        if not self.client:
            self.logger.error("MQTT client not initialized")
            return False
            
        try:
            self.client.connect(
                self.app.config['MQTT_BROKER_URL'],
                self.app.config['MQTT_BROKER_PORT'],
                60  # Keep alive in seconds
            )
            # Start the loop in a separate thread
            self.client.loop_start()
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to MQTT broker: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from the MQTT broker."""
        if self.client and self.is_connected:
            self.client.loop_stop()
            self.client.disconnect()
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback when client connects to the broker."""
        if rc == 0:
            self.is_connected = True
            self.logger.info("Connected to MQTT broker")
            
            # Subscribe to topics
            self.subscribe(self.app.config['MQTT_TOPIC_TEMPERATURE'])
            self.subscribe(self.app.config['MQTT_TOPIC_HUMIDITY'])
            self.subscribe(self.app.config['MQTT_TOPIC_LIGHT'])
            self.subscribe(self.app.config['MQTT_TOPIC_DEVICE_STATUS'])
            
            # Subscribe to legacy topics for backward compatibility
            if hasattr(self.app.config, 'MQTT_LEGACY_TOPIC_TEMPERATURE'):
                self.subscribe(self.app.config['MQTT_LEGACY_TOPIC_TEMPERATURE'])
                self.subscribe(self.app.config['MQTT_LEGACY_TOPIC_HUMIDITY'])
                self.subscribe(self.app.config['MQTT_LEGACY_TOPIC_LIGHT'])
                self.subscribe(self.app.config['MQTT_LEGACY_TOPIC_DEVICE_STATUS'])
        else:
            self.is_connected = False
            self.logger.error(f"Failed to connect to MQTT broker with result code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback when client disconnects from the broker."""
        self.is_connected = False
        if rc != 0:
            self.logger.warning(f"Unexpected MQTT disconnection with result code {rc}")
        else:
            self.logger.info("Disconnected from MQTT broker")
    
    def on_message(self, client, userdata, msg):
        """Callback when a message is received from the broker."""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            self.logger.debug(f"Received message on topic '{topic}': {payload}")
            
            # Process message based on topic
            from models import Device, SensorData, db
            
            # Extract floor, location and measurement type from topic
            # Example topic: home/floor1/living_room/temperature
            parts = topic.split('/')
            if len(parts) >= 4:  # Format: home/floorX/location/type
                floor_str = parts[1]
                location = parts[2]
                measurement_type = parts[3]
                
                # Extract floor number from string (e.g., "floor1" -> 1)
                floor = int(floor_str.replace('floor', '')) if 'floor' in floor_str else 1
                
                # Try to parse payload as JSON
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    data = {"value": payload}
                
                with self.app.app_context():
                    # Find device by floor, location and type
                    device = Device.query.filter_by(
                        floor=floor,
                        location=location, 
                        type=measurement_type
                    ).first()
                    
                    if device:
                        # Update device status
                        device.last_seen = datetime.utcnow()
                        device.status = 'online'
                        
                        # Handle different measurement types
                        if measurement_type in ['temperature', 'humidity', 'light']:
                            value = float(data.get('value', 0))
                            unit = data.get('unit', self._get_default_unit(measurement_type))
                            
                            # Save sensor data
                            sensor_data = SensorData(
                                device_id=device.id,
                                value=value,
                                unit=unit
                            )
                            db.session.add(sensor_data)
                            
                            # Prepare data for real-time update
                            update_data = {
                                'device_id': device.device_id,
                                'device_name': device.name,
                                'floor': device.floor,
                                'location': device.location,
                                'type': device.type,
                                'value': value,
                                'unit': unit,
                                'timestamp': datetime.utcnow().isoformat()
                            }
                            
                            # Emit to Socket.IO
                            self.socketio.emit(
                                'sensor_update', 
                                update_data
                            )
                        
                        elif measurement_type == 'status':
                            # Device status update
                            status = data.get('status', 'unknown')
                            device.status = status
                            
                            # Emit to Socket.IO
                            self.socketio.emit(
                                'device_status', 
                                {
                                    'device_id': device.device_id,
                                    'floor': device.floor,
                                    'location': device.location,
                                    'status': status,
                                    'timestamp': datetime.utcnow().isoformat()
                                }
                            )
                        
                        db.session.commit()
                    elif len(parts) >= 3:  # Try old format: home/location/type
                        # For backward compatibility
                        location = parts[1]
                        measurement_type = parts[2]
                        
                        device = Device.query.filter_by(
                            location=location, 
                            type=measurement_type
                        ).first()
                        
                        if device:
                            # Process device as before
                            # ...existing code for processing device...
                            pass
                        
        except Exception as e:
            self.logger.error(f"Error processing MQTT message: {e}")
    
    def subscribe(self, topic):
        """Subscribe to a topic."""
        if self.client and self.is_connected:
            self.client.subscribe(topic)
            self.logger.info(f"Subscribed to topic: {topic}")
    
    def publish(self, topic, payload, qos=0, retain=False):
        """Publish a message to a topic."""
        if self.client and self.is_connected:
            if isinstance(payload, dict):
                payload = json.dumps(payload)
            self.client.publish(topic, payload, qos, retain)
            return True
        return False
    
    def _get_default_unit(self, measurement_type):
        """Get default unit for a measurement type."""
        units = {
            'temperature': '°C',
            'humidity': '%',
            'light': 'lux'
        }
        return units.get(measurement_type, '')