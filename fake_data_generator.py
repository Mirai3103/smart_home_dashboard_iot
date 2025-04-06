import os
import random
from datetime import datetime, timedelta
from faker import Faker
import argparse
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# Import models
from models import (
    db, User, UserRole, UserRoleMapping, Home, Floor, Room,
    Device, SensorData, UserAction, HomeAccess
)

# Initialize Faker
fake = Faker()

# Configure Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///smart_home.db'  # Change as needed
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Common device types per room
DEVICE_TYPES = {
    'kitchen': ['smart_refrigerator', 'smart_oven', 'smoke_detector', 'temperature_sensor'],
    'living_room': ['smart_tv', 'smart_speaker', 'light_switch', 'motion_sensor'],
    'bedroom': ['smart_light', 'ac_control', 'temperature_sensor', 'smart_alarm'],
    'bathroom': ['humidity_sensor', 'smart_scale', 'water_leak_sensor', 'smart_mirror'],
    'garage': ['garage_door_controller', 'motion_sensor', 'car_charger', 'security_camera'],
    'garden': ['irrigation_control', 'light_sensor', 'weather_station', 'motion_sensor'],
    'hallway': ['motion_sensor', 'smart_light', 'security_camera'],
    'office': ['smart_light', 'temperature_sensor', 'smart_speaker', 'security_camera'],
}

ROOM_TYPES = ['kitchen', 'living_room', 'bedroom', 'bathroom', 'garage', 'garden', 'hallway', 'office']
ACCESS_LEVELS = ['owner', 'admin', 'user', 'guest']
DEVICE_STATUSES = ['online', 'offline', 'maintenance', 'error']
ACTION_STATUSES = ['pending', 'completed', 'failed', 'cancelled']

def create_users(count=10):
    """Create fake users"""
    print(f"Creating {count} users...")
    users = []
    
    # Create one admin user
    admin = User(
        username="admin",
        email="admin@example.com",
        first_name="Admin",
        last_name="User",
        is_admin=True,
        created_at=datetime.utcnow(),
        last_login=datetime.utcnow()
    )
    admin.set_password("admin123")
    users.append(admin)
    
    # Create regular users
    for i in range(count-1):
        first_name = fake.first_name()
        last_name = fake.last_name()
        username = f"{first_name.lower()}{last_name.lower()}{random.randint(1, 999)}"
        email = f"{username}@{fake.domain_name()}"
        
        user = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_admin=False,
            created_at=fake.date_time_between(start_date='-1y', end_date='now'),
            last_login=fake.date_time_between(start_date='-1m', end_date='now')
        )
        # user.set_password(fake.password(length=10))
        user.set_password("password123")
        users.append(user)
    
    db.session.add_all(users)
    db.session.commit()
    return users

def create_roles():
    """Create user roles"""
    print("Creating user roles...")
    roles = [
        UserRole(name="administrator", description="Full system access"),
        UserRole(name="home_owner", description="Can manage home settings"),
        UserRole(name="family_member", description="Can control devices"),
        UserRole(name="guest", description="Limited access to specific devices")
    ]
    
    db.session.add_all(roles)
    db.session.commit()
    return roles

def assign_roles_to_users(users, roles):
    """Assign roles to users"""
    print("Assigning user roles...")
    role_mappings = []
    
    # Admin gets administrator role
    role_mappings.append(UserRoleMapping(user_id=users[0].id, role_id=roles[0].id))
    
    # Distribute other roles
    for user in users[1:]:
        # Assign 1-2 roles to each user
        num_roles = random.randint(1, 2)
        selected_roles = random.sample(roles[1:], num_roles)
        
        for role in selected_roles:
            role_mappings.append(UserRoleMapping(user_id=user.id, role_id=role.id))
    
    db.session.add_all(role_mappings)
    db.session.commit()

def create_homes(users, count=5):
    """Create homes for users - one home per user"""
    # Exclude admin (first user) and ensure count doesn't exceed available users
    available_users = users[1:]
    if count > len(available_users):
        count = len(available_users)
        print(f"Warning: Adjusted home count to {count} to match available users")
    
    print(f"Creating {count} homes (one per user)...")
    homes = []
    
    # Select users without replacement - each user gets exactly one home
    selected_users = random.sample(available_users, count)
    
    for user in selected_users:
        home = Home(
            name=fake.word().capitalize() + " " + random.choice(["House", "Home", "Residence", "Place"]),
            address=fake.address().replace("\n", ", "),
            owner_id=user.id,
            created_at=fake.date_time_between(start_date='-2y', end_date='-1m')
        )
        homes.append(home)
    
    db.session.add_all(homes)
    db.session.commit()
    return homes

def create_floors(homes):
    """Create floors for each home"""
    print("Creating floors...")
    floors = []
    
    for home in homes:
        # Each home has 1-3 floors
        num_floors = random.randint(1, 3)
        
        for i in range(num_floors):
            floor_number = i
            if i == 0:
                name = "Ground Floor"
            else:
                name = f"{i}{['st', 'nd', 'rd'][i-1] if i <= 3 else 'th'} Floor"
                
            floor = Floor(
                home_id=home.id,
                floor_number=floor_number,
                name=name
            )
            floors.append(floor)
    
    db.session.add_all(floors)
    db.session.commit()
    return floors

def create_rooms(floors):
    """Create rooms for each floor"""
    print("Creating rooms...")
    rooms = []
    
    for floor in floors:
        # Each floor has 2-5 rooms
        num_rooms = random.randint(2, 5)
        
        # Ensure variety of room types on each floor
        floor_room_types = random.sample(ROOM_TYPES, min(num_rooms, len(ROOM_TYPES)))
        if len(floor_room_types) < num_rooms:
            floor_room_types += random.choices(ROOM_TYPES, k=(num_rooms - len(floor_room_types)))
        
        for i in range(num_rooms):
            room_type = floor_room_types[i]
            
            if room_type == "bedroom":
                name = random.choice(["Master Bedroom", "Guest Bedroom", "Kids Bedroom", "Bedroom"])
            elif room_type == "bathroom":
                name = random.choice(["Main Bathroom", "Guest Bathroom", "Ensuite Bathroom"])
            else:
                name = room_type.replace("_", " ").title()
            
            room = Room(
                floor_id=floor.id,
                name=name,
                room_type=room_type
            )
            rooms.append(room)
    
    db.session.add_all(rooms)
    db.session.commit()
    return rooms

def create_devices(rooms):
    """Create devices for each room"""
    print("Creating devices...")
    devices = []
    
    for room in rooms:
        # Each room has 1-4 devices
        num_devices = random.randint(1, 4)
        
        # Get appropriate device types for this room type
        appropriate_device_types = DEVICE_TYPES.get(room.room_type, ['smart_light', 'temperature_sensor'])
        
        for i in range(num_devices):
            device_type = random.choice(appropriate_device_types)
            
            device = Device(
                device_id=f"DEV-{fake.uuid4()[:8]}",
                name=f"{device_type.replace('_', ' ').title()} {random.randint(1, 100)}",
                type=device_type,
                room_id=room.id,
                status=random.choice(DEVICE_STATUSES),
                last_seen=fake.date_time_between(start_date='-7d', end_date='now'),
                is_active=random.random() > 0.1  # 90% of devices are active
            )
            devices.append(device)
    
    db.session.add_all(devices)
    db.session.commit()
    return devices

def create_sensor_data(devices, days=30):
    """Create historical sensor data for devices"""
    print(f"Creating sensor data for the past {days} days...")
    sensor_data = []
    
    # Only generate sensor data for actual sensors
    sensor_devices = [d for d in devices if any(sensor_type in d.type for sensor_type in 
                                             ['sensor', 'detector', 'meter', 'temperature', 'humidity'])]
    
    for device in sensor_devices:
        # Generate data points for each day
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Determine appropriate value range and unit based on device type
        if 'temperature' in device.type:
            min_val, max_val = 18.0, 28.0
            unit = '°C'
        elif 'humidity' in device.type:
            min_val, max_val = 30.0, 70.0
            unit = '%'
        elif 'light' in device.type or 'motion' in device.type:
            min_val, max_val = 0.0, 1.0
            unit = 'bool'
        else:
            min_val, max_val = 0.0, 100.0
            unit = 'unit'
            
        # Create multiple readings per day (1-24)
        readings_per_day = random.randint(4, 24)
        for day in range(days):
            for _ in range(readings_per_day):
                timestamp = start_date + timedelta(days=day, 
                                                minutes=random.randint(0, 1439))
                
                # Create some patterns in the data
                hour = timestamp.hour
                if 'temperature' in device.type:
                    # Temperature is lower at night, higher during day
                    if hour < 6 or hour > 20:
                        value = random.uniform(min_val - 3, min_val + 2)
                    else:
                        value = random.uniform(min_val + 2, max_val)
                elif 'light' in device.type:
                    # Light sensors detect light during the day
                    if 7 <= hour <= 19:
                        value = random.uniform(0.7, 1.0)
                    else:
                        value = random.uniform(0.0, 0.3)
                else:
                    value = random.uniform(min_val, max_val)
                
                data = SensorData(
                    device_id=device.device_id,  # Changed to use device_id instead of id
                    value=round(value, 2),
                    unit=unit,
                    timestamp=timestamp
                )
                sensor_data.append(data)
                
        # Batch commit to avoid memory issues
        if len(sensor_data) >= 5000:
            db.session.add_all(sensor_data)
            db.session.commit()
            sensor_data = []
    
    # Final commit for remaining data
    if sensor_data:
        db.session.add_all(sensor_data)
        db.session.commit()

def create_user_actions(users, devices, count=200):
    """Create user actions for devices"""
    print(f"Creating {count} user actions...")
    actions = []
    
    # Create actions spread over the last 30 days
    start_date = datetime.utcnow() - timedelta(days=30)
    
    for _ in range(count):
        user = random.choice(users)
        device = random.choice(devices)
        
        # Action depends on device type
        if 'light' in device.type:
            action = random.choice(['turn_on', 'turn_off', 'dim', 'change_color'])
            if action == 'dim':
                value = str(random.randint(10, 100))
            elif action == 'change_color':
                value = random.choice(['white', 'warm', 'cool', 'red', 'blue', 'green'])
            else:
                value = None
        elif 'temperature' in device.type or 'ac' in device.type:
            action = 'set_temperature'
            value = str(random.randint(18, 26))
        elif 'tv' in device.type:
            action = random.choice(['turn_on', 'turn_off', 'change_channel', 'adjust_volume'])
            if action == 'change_channel':
                value = str(random.randint(1, 200))
            elif action == 'adjust_volume':
                value = str(random.randint(1, 30))
            else:
                value = None
        else:
            action = random.choice(['turn_on', 'turn_off', 'configure', 'reset'])
            value = None if action in ['turn_on', 'turn_off', 'reset'] else 'setting' + str(random.randint(1, 5))
            
        # Actions should be more frequent in recent days
        days_ago = random.choices(range(30), 
                                weights=[i+1 for i in range(30)], # Higher weight for recent days
                                k=1)[0]
        timestamp = start_date + timedelta(days=days_ago, 
                                         hours=random.randint(0, 23),
                                         minutes=random.randint(0, 59))
        
        user_action = UserAction(
            device_id=device.device_id,  # Changed to use device_id instead of id
            action=action,
            value=value,
            timestamp=timestamp,
            status=random.choice(ACTION_STATUSES),
            user_id=user.id
        )
        actions.append(user_action)
    
    db.session.add_all(actions)
    db.session.commit()

def create_home_access(users, homes):
    """Set up home access permissions"""
    print("Setting up home access permissions...")
    access_entries = []
    
    for home in homes:
        # Owner already has access by default
        owner_id = home.owner_id
        access_entries.append(HomeAccess(
            home_id=home.id,
            user_id=owner_id,
            access_level='owner'
        ))
        
        # Add 0-3 additional users with access to each home
        num_additional = random.randint(0, 3)
        eligible_users = [u for u in users if u.id != owner_id]
        
        if eligible_users and num_additional > 0:
            additional_users = random.sample(eligible_users, min(num_additional, len(eligible_users)))
            
            for user in additional_users:
                level = random.choice(['admin', 'user', 'guest'])
                access_entries.append(HomeAccess(
                    home_id=home.id,
                    user_id=user.id,
                    access_level=level
                ))
    
    db.session.add_all(access_entries)
    db.session.commit()

def main(args):
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()
        
        # Check if we should clear existing data
        if args.clear:
            print("Clearing existing data...")
            db.drop_all()
            db.create_all()
        
        # Generate data
        users = create_users(args.users)
        roles = create_roles()
        assign_roles_to_users(users, roles)
        
        homes = create_homes(users, args.homes)
        floors = create_floors(homes)
        rooms = create_rooms(floors)
        
        devices = create_devices(rooms)
        
        create_sensor_data(devices, args.days)
        create_user_actions(users, devices, args.actions)
        create_home_access(users, homes)
        
        print("Fake data generation completed successfully!")
        print(f"Generated: {len(users)} users, {len(homes)} homes, {len(floors)} floors, "
              f"{len(rooms)} rooms, {len(devices)} devices")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate fake data for Smart Home Dashboard')
    
    parser.add_argument('--clear', action='store_true', 
                        help='Clear existing data before generating new data')
    parser.add_argument('--users', type=int, default=10, 
                        help='Number of users to generate')
    parser.add_argument('--homes', type=int, default=5, 
                        help='Number of homes to generate')
    parser.add_argument('--days', type=int, default=30, 
                        help='Number of days of historical sensor data to generate')
    parser.add_argument('--actions', type=int, default=200, 
                        help='Number of user actions to generate')
    
    args = parser.parse_args()
    main(args)