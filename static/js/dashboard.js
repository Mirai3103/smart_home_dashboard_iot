// Dashboard specific functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize device controls
  initializeDeviceControls();
  
  // Initialize room filter
  initializeRoomFilter();
  
  // Initialize real-time data updates
  initializeRealTimeUpdates();
  
  // Update device statistics
  updateDeviceStatistics();
  
  // Periodically update relative times
  setInterval(updateRelativeTimes, 60000); // Update every minute
  
  // Periodically refresh device data
  setInterval(refreshDeviceData, 60000); // Update every minute
});

// Initialize device controls
function initializeDeviceControls() {
  // Toggle switches
  const toggleSwitches = document.querySelectorAll('.device-toggle input');
  toggleSwitches.forEach(toggle => {
      toggle.addEventListener('change', function() {
          const deviceId = this.getAttribute('data-device-id');
          const action = this.checked ? 'on' : 'off';
          
          // Call control function from socket_handler.js
          controlDevice(deviceId, action);
      });
  });
  
  // Range sliders
  const rangeSliders = document.querySelectorAll('.range-control input[type="range"]');
  rangeSliders.forEach(slider => {
      // Update value display when slider moves
      slider.addEventListener('input', function() {
          const valueDisplay = document.querySelector(`#${this.getAttribute('data-value-display')}`);
          if (valueDisplay) {
              valueDisplay.textContent = this.value;
          }
      });
      
      // Send control command when slider is released
      slider.addEventListener('change', function() {
          const deviceId = this.getAttribute('data-device-id');
          const action = this.getAttribute('data-action') || 'set_value';
          
          // Call control function from socket_handler.js
          controlDevice(deviceId, action, this.value);
      });
  });
  
  // Action buttons
  const actionButtons = document.querySelectorAll('.device-action-btn');
  actionButtons.forEach(button => {
      button.addEventListener('click', function() {
          const deviceId = this.getAttribute('data-device-id');
          const action = this.getAttribute('data-action');
          const value = this.getAttribute('data-value');
          
          // Call control function from socket_handler.js
          controlDevice(deviceId, action, value);
      });
  });
}

// Initialize room filter
function initializeRoomFilter() {
  const roomFilters = document.querySelectorAll('.room-filter');
  if (roomFilters.length === 0) return;
  
  roomFilters.forEach(filter => {
      filter.addEventListener('click', function() {
          const room = this.getAttribute('data-room');
          
          // Toggle active state
          roomFilters.forEach(btn => btn.classList.remove('active'));
          this.classList.add('active');
          
          // Filter devices
          filterDevicesByRoom(room);
      });
  });
  
  // Set "All" as default active filter
  const allFilter = document.querySelector('.room-filter[data-room="all"]');
  if (allFilter) {
      allFilter.classList.add('active');
  }
}

// Filter devices by room
function filterDevicesByRoom(room) {
  const deviceCards = document.querySelectorAll('.device-card');
  
  deviceCards.forEach(card => {
      if (room === 'all') {
          card.closest('.device-card-container').classList.remove('d-none');
      } else {
          const deviceRoom = card.getAttribute('data-room');
          if (deviceRoom === room) {
              card.closest('.device-card-container').classList.remove('d-none');
          } else {
              card.closest('.device-card-container').classList.add('d-none');
          }
      }
  });
}

// Update all relative time displays (e.g., "5 minutes ago")
function updateRelativeTimes() {
  const timeElements = document.querySelectorAll('[data-timestamp]');
  
  timeElements.forEach(element => {
      const timestamp = element.getAttribute('data-timestamp');
      if (timestamp) {
          element.textContent = formatRelativeTime(timestamp);
      }
  });
}

// Handle thermostat mode changes
function changeThermostatMode(deviceId, mode) {
  const modeButtons = document.querySelectorAll(`.thermostat-mode[data-device-id="${deviceId}"]`);
  
  // Update UI
  modeButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-mode') === mode) {
          btn.classList.add('active');
      }
  });
  
  // Send control command
  controlDevice(deviceId, 'set_mode', mode);
}

// Handle fan speed changes
function changeFanSpeed(deviceId, speed) {
  const speedButtons = document.querySelectorAll(`.fan-speed[data-device-id="${deviceId}"]`);
  
  // Update UI
  speedButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-speed') === speed) {
          btn.classList.add('active');
      }
  });
  
  // Send control command
  controlDevice(deviceId, 'set_speed', speed);
}

// Update device statistics based on actual data
function updateDeviceStatistics() {
  // Count online devices
  const onlineDevices = document.querySelectorAll('.device-status.status-online');
  document.querySelector('.stat-card-value:nth-child(2)').textContent = onlineDevices.length;
  
  // Calculate average temperature
  let tempSum = 0;
  let tempCount = 0;
  document.querySelectorAll('.value-display[data-device-type="temperature"]').forEach(el => {
    const value = parseFloat(el.textContent);
    if (!isNaN(value)) {
      tempSum += value;
      tempCount++;
    }
  });
  
  if (tempCount > 0) {
    document.getElementById('avg-temperature').textContent = (tempSum / tempCount).toFixed(1) + '°C';
  }
  
  // Calculate average humidity
  let humSum = 0;
  let humCount = 0;
  document.querySelectorAll('.value-display[data-device-type="humidity"]').forEach(el => {
    const value = parseFloat(el.textContent);
    if (!isNaN(value)) {
      humSum += value;
      humCount++;
    }
  });
  
  if (humCount > 0) {
    document.getElementById('avg-humidity').textContent = (humSum / humCount).toFixed(0) + '%';
  }
}

// Initialize real-time updates for devices
function initializeRealTimeUpdates() {
  // Check if socket is defined (from socket_handler.js)
  if (typeof socket === 'undefined') {
    console.error('Socket.io not initialized');
    return;
  }
  
  // Listen for device updates
  socket.on('device_update', function(data) {
    updateDeviceDisplay(data.device_id, data);
  });
  
  // Listen for sensor data updates
  socket.on('sensor_data', function(data) {
    updateSensorDisplay(data.device_id, data);
  });
}

// Update device display with new data
function updateDeviceDisplay(deviceId, data) {
  const statusElement = document.querySelector(`.device-status[data-device-id="${deviceId}"]`);
  const statusTextElement = document.querySelector(`.device-status-text[data-device-id="${deviceId}"]`);
  
  if (statusElement && data.status) {
    statusElement.className = `device-status status-${data.status}`;
  }
  
  if (statusTextElement && data.status) {
    statusTextElement.textContent = data.status;
  }
  
  // Update toggle state if applicable
  if (data.status === 'on' || data.status === 'off') {
    const toggleElement = document.querySelector(`input[type="checkbox"][data-device-id="${deviceId}"]`);
    if (toggleElement) {
      toggleElement.checked = (data.status === 'on');
    }
  }
  
  // Update brightness if applicable
  if (data.brightness !== undefined) {
    const brightnessSlider = document.querySelector(`input[type="range"][data-device-id="${deviceId}"]`);
    if (brightnessSlider) {
      brightnessSlider.value = data.brightness;
      
      // Also update the displayed value
      const valueDisplay = document.querySelector(`#${brightnessSlider.getAttribute('data-value-display')}`);
      if (valueDisplay) {
        valueDisplay.textContent = data.brightness;
      }
    }
  }
  
  // Update last seen time
  if (data.timestamp) {
    const lastSeenElement = document.querySelector(`.last-updated-time[data-device-id="${deviceId}"]`);
    if (lastSeenElement) {
      lastSeenElement.setAttribute('data-timestamp', data.timestamp);
      lastSeenElement.textContent = formatRelativeTime(data.timestamp);
    }
  }
}

// Update sensor display with new data
function updateSensorDisplay(deviceId, data) {
  // Update the value display
  const valueDisplay = document.querySelector(`.value-display[data-device-id="${deviceId}"]`);
  if (valueDisplay && data.value !== undefined) {
    valueDisplay.textContent = data.value;
    valueDisplay.setAttribute('data-device-type', data.type);
  }
  
  // Update icon colors based on values
  if (data.type === 'temperature') {
    const iconElement = document.querySelector(`.temperature-icon[data-device-id="${deviceId}"]`);
    if (iconElement) {
      updateTemperatureIcon(iconElement, data.value);
    }
  } else if (data.type === 'humidity') {
    const iconElement = document.querySelector(`.humidity-indicator[data-device-id="${deviceId}"]`);
    if (iconElement) {
      updateHumidityIcon(iconElement, data.value);
    }
  }
  
  // Update last seen time
  if (data.timestamp) {
    const lastSeenElement = document.querySelector(`.last-updated-time[data-device-id="${deviceId}"]`);
    if (lastSeenElement) {
      lastSeenElement.setAttribute('data-timestamp', data.timestamp);
      lastSeenElement.textContent = formatRelativeTime(data.timestamp);
    }
  }
  
  // Update statistics after sensor update
  updateDeviceStatistics();
}

// Update temperature icon color based on value
function updateTemperatureIcon(iconElement, value) {
  // Remove existing color classes
  iconElement.classList.remove('text-primary', 'text-success', 'text-warning', 'text-danger', 'text-info');
  
  // Add appropriate color class based on temperature
  if (value < 15) {
    iconElement.classList.add('text-info');
  } else if (value >= 15 && value < 22) {
    iconElement.classList.add('text-success');
  } else if (value >= 22 && value < 26) {
    iconElement.classList.add('text-primary');
  } else if (value >= 26 && value < 30) {
    iconElement.classList.add('text-warning');
  } else {
    iconElement.classList.add('text-danger');
  }
}

// Update humidity icon color based on value
function updateHumidityIcon(iconElement, value) {
  // Remove existing color classes
  iconElement.classList.remove('text-primary', 'text-success', 'text-warning', 'text-danger', 'text-info');
  
  // Add appropriate color class based on humidity
  if (value < 30) {
    iconElement.classList.add('text-warning');
  } else if (value >= 30 && value < 40) {
    iconElement.classList.add('text-info');
  } else if (value >= 40 && value < 60) {
    iconElement.classList.add('text-success');
  } else if (value >= 60 && value < 70) {
    iconElement.classList.add('text-primary');
  } else {
    iconElement.classList.add('text-danger');
  }
}

// Format timestamp as relative time (e.g., "5 minutes ago")
function formatRelativeTime(timestamp) {
  if (!timestamp) return 'never';
  
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) {
    return 'just now';
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  } else {
    const days = Math.floor(seconds / 86400);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }
}

// Refresh device data from the server
function refreshDeviceData() {
  const deviceCards = document.querySelectorAll('[data-device-id]');
  const deviceIds = new Set();
  
  // Collect unique device IDs
  deviceCards.forEach(card => {
    const deviceId = card.getAttribute('data-device-id');
    if (deviceId) {
      deviceIds.add(deviceId);
    }
  });
  
  // Request latest data for each device
  deviceIds.forEach(deviceId => {
    fetch(`/api/devices/${deviceId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateDeviceDisplay(deviceId, data.device);
        }
      })
      .catch(error => console.error('Error refreshing device data:', error));
  });
}