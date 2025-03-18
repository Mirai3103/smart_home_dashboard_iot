from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Device(db.Model):
    __tablename__ = 'devices'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # temperature, humidity, light, switch, etc.
    location = db.Column(db.String(100), nullable=False)  # living_room, kitchen, bedroom, etc.
    status = db.Column(db.String(20), default='offline')  # online, offline, error
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    sensor_data = db.relationship('SensorData', backref='device', lazy=True, cascade="all, delete-orphan")
    user_actions = db.relationship('UserAction', backref='device', lazy=True, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<Device {self.name} ({self.device_id})>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'name': self.name,
            'type': self.type,
            'location': self.location,
            'status': self.status,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'is_active': self.is_active
        }


class SensorData(db.Model):
    __tablename__ = 'sensor_data'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('devices.id'), nullable=False)
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10), nullable=True)  # °C, %, lux, etc.
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SensorData {self.device_id}: {self.value} {self.unit}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'value': self.value,
            'unit': self.unit,
            'timestamp': self.timestamp.isoformat()
        }


class UserAction(db.Model):
    __tablename__ = 'user_actions'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('devices.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # on, off, set_temperature, etc.
    value = db.Column(db.String(50), nullable=True)    # Value associated with the action
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # pending, success, failed
    
    def __repr__(self):
        return f'<UserAction {self.device_id}: {self.action} - {self.status}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'action': self.action,
            'value': self.value,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status
        }