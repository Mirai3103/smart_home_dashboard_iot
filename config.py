import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('FLASK_DEBUG') or True
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///smart_home.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # MQTT configuration
    MQTT_BROKER_URL = os.environ.get('MQTT_BROKER_URL') or 'broker.shiftr.io'
    MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT') or 1883)
    MQTT_USERNAME = os.environ.get('MQTT_USERNAME') or 'YOUR_SHIFTR_KEY'
    MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD') or 'YOUR_SHIFTR_SECRET'
    MQTT_CLIENT_ID = os.environ.get('MQTT_CLIENT_ID') or 'smart_home_dashboard'
    
    # MQTT topics
    MQTT_TOPIC_TEMPERATURE = 'home/+/+/temperature'  # Updated for floor: home/floorX/room/temperature
    MQTT_TOPIC_HUMIDITY = 'home/+/+/humidity'
    MQTT_TOPIC_LIGHT = 'home/+/+/light'  # Fixed from humidity to light
    MQTT_TOPIC_DEVICE_STATUS = 'home/+/+/status'
    MQTT_TOPIC_DEVICE_CONTROL = 'home/+/+/control'
    
    # Legacy topics (for backward compatibility)
    MQTT_LEGACY_TOPIC_TEMPERATURE = 'home/+/temperature'
    MQTT_LEGACY_TOPIC_HUMIDITY = 'home/+/humidity'
    MQTT_LEGACY_TOPIC_LIGHT = 'home/+/light'
    MQTT_LEGACY_TOPIC_DEVICE_STATUS = 'home/+/status'
    MQTT_LEGACY_TOPIC_DEVICE_CONTROL = 'home/+/control'  # Added missing legacy control topic
    
    # Other settings
    DATA_RETENTION_DAYS = 30  # Default data retention period