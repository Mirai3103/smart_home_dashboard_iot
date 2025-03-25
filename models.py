from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

db = SQLAlchemy()

# User Authentication and Authorization
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    access_token = db.Column(db.String(128), unique=True, index=True)
    token_expiry = db.Column(db.DateTime)
    
    # Relationships
    homes = db.relationship('Home', backref='owner', lazy=True)
    actions = db.relationship('UserAction', backref='user', lazy=True)
    role_mappings = db.relationship('UserRoleMapping', backref='user', lazy=True, cascade="all, delete-orphan")
    home_accesses = db.relationship('HomeAccess', backref='user', lazy=True, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'access_token': self.access_token,
            'token_expiry': self.token_expiry.isoformat() if self.token_expiry else None
        }


class UserRole(db.Model):
    __tablename__ = 'user_roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))
    
    # Relationships
    user_mappings = db.relationship('UserRoleMapping', backref='role', lazy=True, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<UserRole {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }


class UserRoleMapping(db.Model):
    __tablename__ = 'user_role_mappings'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('user_roles.id'), nullable=False)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'role_id', name='unique_user_role'),
    )
    
    def __repr__(self):
        return f'<UserRoleMapping User:{self.user_id} Role:{self.role_id}>'


# Home Structure
class Home(db.Model):
    __tablename__ = 'homes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    floors = db.relationship('Floor', backref='home', lazy=True, cascade="all, delete-orphan")
    access_users = db.relationship('HomeAccess', backref='home', lazy=True, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<Home {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'owner_id': self.owner_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Floor(db.Model):
    __tablename__ = 'floors'
    
    id = db.Column(db.Integer, primary_key=True)
    home_id = db.Column(db.Integer, db.ForeignKey('homes.id'), nullable=False)
    floor_number = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(50))
    
    # Relationships
    rooms = db.relationship('Room', backref='floor', lazy=True, cascade="all, delete-orphan")
    
    __table_args__ = (
        db.UniqueConstraint('home_id', 'floor_number', name='unique_floor_in_home'),
    )
    
    def __repr__(self):
        return f'<Floor {self.floor_number} in Home {self.home_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'home_id': self.home_id,
            'floor_number': self.floor_number,
            'name': self.name
        }


class Room(db.Model):
    __tablename__ = 'rooms'
    
    id = db.Column(db.Integer, primary_key=True)
    floor_id = db.Column(db.Integer, db.ForeignKey('floors.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    room_type = db.Column(db.String(50), nullable=False)
    
    # Relationships
    devices = db.relationship('Device', backref='room', lazy=True, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<Room {self.name} on Floor {self.floor_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'floor_id': self.floor_id,
            'name': self.name,
            'room_type': self.room_type
        }


# Devices and Data
class Device(db.Model):
    __tablename__ = 'devices'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    status = db.Column(db.String(20), default='offline')
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships using device_id as the key
    sensor_data = db.relationship('SensorData', backref='device', lazy=True, 
                                 foreign_keys='SensorData.device_id',
                                 primaryjoin='Device.device_id==SensorData.device_id',
                                 cascade="all, delete-orphan")
    user_actions = db.relationship('UserAction', backref='device', lazy=True, 
                                  foreign_keys='UserAction.device_id',
                                  primaryjoin='Device.device_id==UserAction.device_id',
                                  cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<Device {self.name} ({self.device_id})>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'name': self.name,
            'type': self.type,
            'room_id': self.room_id,
            'status': self.status,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'is_active': self.is_active
        }


class SensorData(db.Model):
    __tablename__ = 'sensor_data'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('devices.device_id'), nullable=False) 
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.Index('idx_device_timestamp', 'device_id', 'timestamp'),
    )
    
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
    device_id = db.Column(db.String(50), db.ForeignKey('devices.device_id'), nullable=False) 
    action = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    __table_args__ = (
        db.Index('idx_action_device_timestamp', 'device_id', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<UserAction {self.device_id}: {self.action} - {self.status}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'action': self.action,
            'value': self.value,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status,
            'user_id': self.user_id
        }


# Access Control
class HomeAccess(db.Model):
    __tablename__ = 'home_access'
    
    id = db.Column(db.Integer, primary_key=True)
    home_id = db.Column(db.Integer, db.ForeignKey('homes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    access_level = db.Column(db.String(20), nullable=False)  # 'owner', 'admin', 'user', 'guest', etc.
    
    __table_args__ = (
        db.UniqueConstraint('home_id', 'user_id', name='unique_home_user_access'),
    )
    
    def __repr__(self):
        return f'<HomeAccess Home:{self.home_id} User:{self.user_id} Level:{self.access_level}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'home_id': self.home_id,
            'user_id': self.user_id,
            'access_level': self.access_level
        }