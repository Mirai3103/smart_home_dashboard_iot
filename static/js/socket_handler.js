// Socket.IO handler for real-time updates
let socket;
let deviceData = {}; // Cache for device data
let lastUpdateTimes = {}; // Cache for last update times

document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
});

// Initialize Socket.IO connection
function initializeSocket() {
    // Connect to Socket.IO server
    socket = io();
    
    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus('connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus('disconnected');
    });
    
    // Handle sensor data updates
    socket.on('sensor_update', (data) => {
        console.log('Sensor update received:', data);
        
        // Update device data cache
        const deviceId = data.device_id;
        if (!deviceData[deviceId]) {
            deviceData[deviceId] = {};
        }
        
        // Update values
        deviceData[deviceId] = {
            ...deviceData[deviceId],
            ...data
        };
        
        // Update last update time
        lastUpdateTimes[deviceId] = new Date();
        
        // Update UI
        updateDeviceUI(deviceId, data);
        
        // Update charts if they exist
        updateCharts(deviceId, data);
    });
    
    // Handle device status updates
    socket.on('device_status', (data) => {
        console.log('Device status update received:', data);
        
        const deviceId = data.device_id;
        
        // Update device status indicators
        const statusIndicators = document.querySelectorAll(`.device-status[data-device-id="${deviceId}"]`);
        statusIndicators.forEach(indicator => {
            // Remove all status classes
            indicator.classList.remove('status-online', 'status-offline', 'status-error');
            // Add appropriate class
            indicator.classList.add(`status-${data.status}`);
            
            // Update tooltip if exists
            const tooltip = bootstrap.Tooltip.getInstance(indicator);
            if (tooltip) {
                tooltip.setContent({ '.tooltip-inner': `Status: ${data.status}` });
            }
        });
        
        // Update status text if exists
        const statusTexts = document.querySelectorAll(`.device-status-text[data-device-id="${deviceId}"]`);
        statusTexts.forEach(element => {
            element.textContent = data.status;
        });
        
        // Update timestamp if exists
        const timestamps = document.querySelectorAll(`.device-last-seen[data-device-id="${deviceId}"]`);
        timestamps.forEach(element => {
            element.textContent = formatRelativeTime(data.timestamp);
            element.setAttribute('title', formatDate(data.timestamp));
        });
    });
}

// Update UI connection status
function updateConnectionStatus(status) {
    const statusIndicator = document.getElementById('connection-status');
    if (!statusIndicator) return;
    
    if (status === 'connected') {
        statusIndicator.classList.remove('text-danger');
        statusIndicator.classList.add('text-success');
        statusIndicator.querySelector('i').className = 'fas fa-circle';
        statusIndicator.querySelector('span').textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('text-success');
        statusIndicator.classList.add('text-danger');
        statusIndicator.querySelector('i').className = 'fas fa-exclamation-circle';
        statusIndicator.querySelector('span').textContent = 'Disconnected';
    }
}

// Update device UI with new data
function updateDeviceUI(deviceId, data) {
    // Update value displays
    const valueDisplays = document.querySelectorAll(`.value-display[data-device-id="${deviceId}"]`);
    valueDisplays.forEach(display => {
        display.textContent = parseFloat(data.value).toFixed(1);
    });
    
    // Update simple value displays
    const simpleValueDisplays = document.querySelectorAll(`.device-value[data-device-id="${deviceId}"]`);
    simpleValueDisplays.forEach(display => {
        display.textContent = parseFloat(data.value).toFixed(1);
    });
    
    // Update last updated timestamps
    const updateTimeElements = document.querySelectorAll(`.last-updated-time[data-device-id="${deviceId}"]`);
    const formattedTime = formatRelativeTime(data.timestamp);
    
    updateTimeElements.forEach(element => {
        element.textContent = formattedTime;
        element.setAttribute('title', formatDate(data.timestamp));
    });
    
    // Update device cards if they need special handling based on type
    if (data.type === 'temperature') {
        updateTemperatureUI(deviceId, data.value);
    } else if (data.type === 'humidity') {
        updateHumidityUI(deviceId, data.value);
    } else if (data.type === 'light') {
        updateLightUI(deviceId, data.value);
    }
}

// Update temperature specific UI elements
function updateTemperatureUI(deviceId, value) {
    const tempValue = parseFloat(value);
    
    // Get all temperature indicators
    const indicators = document.querySelectorAll(`.temp-indicator[data-device-id="${deviceId}"]`);
    
    indicators.forEach(indicator => {
        // Remove existing classes
        indicator.classList.remove('text-primary', 'text-success', 'text-warning', 'text-danger');
        
        // Add appropriate class based on temperature
        if (tempValue < 18) {
            indicator.classList.add('text-primary'); // Cold
        } else if (tempValue >= 18 && tempValue < 24) {
            indicator.classList.add('text-success'); // Comfortable
        } else if (tempValue >= 24 && tempValue < 30) {
            indicator.classList.add('text-warning'); // Warm
        } else {
            indicator.classList.add('text-danger'); // Hot
        }
    });
}

// Update humidity specific UI elements
function updateHumidityUI(deviceId, value) {
    const humValue = parseFloat(value);
    
    // Get all humidity indicators
    const indicators = document.querySelectorAll(`.humidity-indicator[data-device-id="${deviceId}"]`);
    
    indicators.forEach(indicator => {
        // Remove existing classes
        indicator.classList.remove('text-danger', 'text-warning', 'text-success', 'text-info');
        
        // Add appropriate class based on humidity
        if (humValue < 30) {
            indicator.classList.add('text-danger'); // Very dry
        } else if (humValue >= 30 && humValue < 40) {
            indicator.classList.add('text-warning'); // Dry
        } else if (humValue >= 40 && humValue < 60) {
            indicator.classList.add('text-success'); // Comfortable
        } else {
            indicator.classList.add('text-info'); // Humid
        }
    });
}

// Update light specific UI elements
function updateLightUI(deviceId, value) {
    const lightValue = parseFloat(value);
    
    // Get all light indicators
    const indicators = document.querySelectorAll(`.light-indicator[data-device-id="${deviceId}"]`);
    
    indicators.forEach(indicator => {
        // Remove existing classes
        indicator.classList.remove('text-secondary', 'text-primary', 'text-warning');
        
        // Add appropriate class based on light level
        if (lightValue < 100) {
            indicator.classList.add('text-secondary'); // Dark
        } else if (lightValue >= 100 && lightValue < 500) {
            indicator.classList.add('text-primary'); // Moderate
        } else {
            indicator.classList.add('text-warning'); // Bright
        }
    });
    
    // Light bulb UI updates if they exist
    const lightBulbs = document.querySelectorAll(`.light-bulb[data-device-id="${deviceId}"]`);
    lightBulbs.forEach(bulb => {
        if (lightValue > 0) {
            bulb.classList.add('text-warning');
            bulb.classList.remove('text-secondary');
        } else {
            bulb.classList.add('text-secondary');
            bulb.classList.remove('text-warning');
        }
    });
}

// Device control function
function controlDevice(deviceId, action, value = null) {
    // Check if socket is connected
    if (!socket || !socket.connected) {
        showAlert('Not connected to server. Please refresh the page.', 'danger');
        return;
    }
    
    // Prepare data
    const data = {
        action: action
    };
    
    if (value !== null) {
        data.value = value;
    }
    
    // Show loading UI if needed
    const controlButtons = document.querySelectorAll(`.device-control[data-device-id="${deviceId}"]`);
    controlButtons.forEach(button => {
        button.disabled = true;
        if (button.querySelector('.spinner-border')) {
            button.querySelector('.spinner-border').classList.remove('d-none');
        }
    });
    
    // Send control request via API
    apiRequest(`/api/devices/${deviceId}/control`, 'POST', data)
        .then(response => {
            console.log('Control response:', response);
            if (response.success) {
                showAlert(`Command sent: ${action}`, 'success');
            } else {
                showAlert(response.message || 'Failed to send command', 'danger');
            }
        })
        .catch(error => {
            console.error('Control error:', error);
            showAlert('Error sending command', 'danger');
        })
        .finally(() => {
            // Reset UI
            controlButtons.forEach(button => {
                button.disabled = false;
                if (button.querySelector('.spinner-border')) {
                    button.querySelector('.spinner-border').classList.add('d-none');
                }
            });
        });
}

// Update charts with new data
function updateCharts(deviceId, data) {
    // This will be implemented in charts.js
    if (typeof updateDeviceChart === 'function') {
        updateDeviceChart(deviceId, data);
    }
}