from flask import render_template, redirect, url_for, flash, request, jsonify, current_app
from flask_login import login_required, current_user
from functools import wraps
from . import admin
from models import db, User, Home, Floor, Room, Device, SensorData, UserAction, HomeAccess, UserRole, UserRoleMapping
import logging

# Get logger
logger = logging.getLogger('smart_home')

# Admin access decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            logger.warning(f"Unauthenticated user attempted to access admin route")
            return redirect(url_for('login', next=request.url))
            
        if not current_user.is_admin:
            logger.warning(f"Non-admin user {current_user.username} attempted to access admin route")
            flash('You do not have permission to access this page. Admin rights required.', 'danger')
            return redirect(url_for('index'))
            
        logger.info(f"Admin access granted to {current_user.username}")
        return f(*args, **kwargs)
    return decorated_function

# Admin dashboard
@admin.route('/')
@login_required
@admin_required
def dashboard():
    logger.info(f"Admin dashboard accessed by {current_user.username}")
    return render_template('admin/dashboard.html')

# Users management
@admin.route('/users')
@login_required
@admin_required
def users():
    users_list = User.query.all()
    return render_template('admin/users.html', users=users_list)

# Homes management
@admin.route('/homes')
@login_required
@admin_required
def homes():
    homes_list = Home.query.all()
    users_list = User.query.all()  # Need users list for owner dropdown
    return render_template('admin/homes.html', homes=homes_list, users=users_list)

# Devices management
@admin.route('/devices')
@login_required
@admin_required
def devices():
    devices_list = Device.query.all()
    homes_list = Home.query.all()  # Need homes list for dropdown selection
    return render_template('admin/devices.html', devices=devices_list, homes=homes_list)

# Test route that doesn't require authentication
@admin.route('/test')
def test_admin_access():
    """Test route to verify admin access"""
    if current_user.is_authenticated:
        if current_user.is_admin:
            return jsonify({
                'success': True, 
                'message': f'Admin access confirmed for {current_user.username}',
                'user': {
                    'id': current_user.id,
                    'username': current_user.username,
                    'is_admin': current_user.is_admin
                }
            })
        else:
            return jsonify({
                'success': False,
                'message': 'User is authenticated but not an admin',
                'user': {
                    'id': current_user.id,
                    'username': current_user.username,
                    'is_admin': current_user.is_admin
                }
            })
    else:
        return jsonify({
            'success': False,
            'message': 'User is not authenticated'
        })

# Generic model CRUD API endpoints
@admin.route('/api/<model_name>', methods=['GET'])
@login_required
@admin_required
def get_model_data(model_name):
    """Get all items for a model."""
    # Import here to avoid circular imports
    import models
    model_class = getattr(models, model_name, None)
    if not model_class:
        return jsonify({'error': f'Model {model_name} not found'}), 404
    
    items = model_class.query.all()
    return jsonify([item.to_dict() for item in items])

@admin.route('/api/<model_name>/<int:id>', methods=['GET'])
@login_required
@admin_required
def get_model_item(model_name, id):
    """Get a single item from a model by ID."""
    # Import here to avoid circular imports
    import models
    model_class = getattr(models, model_name, None)
    if not model_class:
        return jsonify({'success': False, 'error': f'Model {model_name} not found'}), 404
    
    item = model_class.query.get(id)
    if not item:
        return jsonify({'success': False, 'error': 'Item not found'}), 404
    
    return jsonify({'success': True, 'data': item.to_dict()})

@admin.route('/api/<model_name>/<int:id>', methods=['PUT'])
@login_required
@admin_required
def update_model_item(model_name, id):
    """Update an existing model item."""
    # Import here to avoid circular imports
    import models
    model_class = getattr(models, model_name, None)
    if not model_class:
        return jsonify({'success': False, 'error': f'Model {model_name} not found'}), 404
    
    item = model_class.query.get(id)
    if not item:
        return jsonify({'success': False, 'error': 'Item not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    # Special handling for User model to hash passwords
    if model_name == 'User' and 'password' in data and data['password']:
        password = data.pop('password')
        for key, value in data.items():
            if hasattr(item, key):
                setattr(item, key, value)
        item.set_password(password)
    else:
        # Update attributes for other models
        for key, value in data.items():
            if hasattr(item, key) and key != 'id':
                setattr(item, key, value)
    
    try:
        db.session.commit()
        logger.info(f"Updated {model_name} id={id}")
        return jsonify({'success': True, 'data': item.to_dict(), 'message': f'{model_name} updated successfully'})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating {model_name} id={id}: {str(e)}")
        return jsonify({'success': False, 'error': f'Error updating item: {str(e)}'}), 500

@admin.route('/api/<model_name>', methods=['POST'])
@login_required
@admin_required
def create_model_item(model_name):
    """Create a new model item."""
    # Import here to avoid circular imports
    import models
    model_class = getattr(models, model_name, None)
    if not model_class:
        return jsonify({'success': False, 'error': f'Model {model_name} not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    # Create new instance
    item = model_class()
    
    # Special handling for User model to hash passwords
    if model_name == 'User' and 'password' in data:
        password = data.pop('password')
        for key, value in data.items():
            if hasattr(item, key):
                setattr(item, key, value)
        item.set_password(password)
    else:
        # Set attributes for other models
        for key, value in data.items():
            if hasattr(item, key):
                setattr(item, key, value)
    
    try:
        db.session.add(item)
        db.session.commit()
        logger.info(f"Created new {model_name}: {item}")
        return jsonify({'success': True, 'data': item.to_dict(), 'message': f'{model_name} created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating {model_name}: {str(e)}")
        return jsonify({'success': False, 'error': f'Error creating item: {str(e)}'}), 500

@admin.route('/api/<model_name>/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_model_item(model_name, id):
    """Delete an existing model item."""
    # Import here to avoid circular imports
    import models
    model_class = getattr(models, model_name, None)
    if not model_class:
        return jsonify({'success': False, 'error': f'Model {model_name} not found'}), 404
    
    item = model_class.query.get(id)
    if not item:
        return jsonify({'success': False, 'error': 'Item not found'}), 404
    
    try:
        db.session.delete(item)
        db.session.commit()
        logger.info(f"Deleted {model_name} id={id}")
        return jsonify({'success': True, 'message': f'{model_name} deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting {model_name} id={id}: {str(e)}")
        return jsonify({'success': False, 'error': f'Error deleting item: {str(e)}'}), 500

@admin.route('/model/<model_name>')
@login_required
@admin_required
def model_editor(model_name):
    """Generic model editor interface."""
    # Import here to avoid circular imports
    import models
    model_class = getattr(models, model_name, None)
    if not model_class:
        flash(f"Model '{model_name}' not found", "danger")
        return redirect(url_for('admin.dashboard'))

    items = model_class.query.all()
    
    # Try to determine the model's primary field (usually 'name' or 'username' etc.)
    primary_field = 'name' if hasattr(model_class, 'name') else 'id'
    if hasattr(model_class, 'username'):
        primary_field = 'username'
    
    return render_template('admin/model_editor.html', 
                           model_name=model_name,
                           items=items,
                           primary_field=primary_field,
                           display_name=model_name.replace('_', ' ').title())

# Room management for a specific floor
@admin.route('/floor/<int:floor_id>/rooms')
@login_required
@admin_required
def floor_rooms(floor_id):
    """Room management for a specific floor."""
    floor = Floor.query.get_or_404(floor_id)
    rooms = Room.query.filter_by(floor_id=floor_id).all()
    
    # Get home info
    home = Home.query.get(floor.home_id)
    
    return render_template('admin/rooms.html', 
                          floor=floor,
                          home=home, 
                          rooms=rooms)

# Add API endpoint to fetch rooms for a floor
@admin.route('/api/floor/<int:floor_id>/rooms', methods=['GET'])
@login_required
@admin_required
def get_floor_rooms(floor_id):
    """Get all rooms for a specific floor."""
    rooms = Room.query.filter_by(floor_id=floor_id).all()
    return jsonify([room.to_dict() for room in rooms])

@admin.route('/api/debug-info', methods=['GET'])
@login_required
@admin_required
def api_debug_info():
    """Get debug information about database models."""
    import inspect
    import models
    
    # Get all model classes from models module
    model_classes = []
    for name, obj in inspect.getmembers(models):
        if inspect.isclass(obj) and hasattr(obj, '__tablename__'):
            try:
                count = obj.query.count()
                model_classes.append({
                    'name': name,
                    'table': obj.__tablename__,
                    'count': count
                })
            except Exception as e:
                model_classes.append({
                    'name': name,
                    'table': obj.__tablename__,
                    'error': str(e)
                })
    
    return jsonify({
        'models': model_classes,
        'session': {
            'is_active': db.session.is_active,
            'info': str(db.session)
        },
        'flask_app_config': {
            'debug': current_app.debug,
            'testing': current_app.testing
        },
        'user_info': {
            'id': current_user.id,
            'username': current_user.username,
            'is_admin': current_user.is_admin
        }
    })