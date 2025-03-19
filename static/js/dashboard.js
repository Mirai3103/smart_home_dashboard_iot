// Dashboard specific JavaScript

// Chart objects
let charts = {};
let deviceData = {};
let socketReconnectAttempts = 0;
let socketInstance = null;
let socketReconnectTimer = null;

// Document ready function
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard page loaded');
    
    // Initialize device controls
    initializeDeviceControls();
    
    // Load device statistics
    loadDeviceStatistics();
    
    // Initialize any charts on the page
    initializeCharts();
    
    // Setup refresh button if it exists
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadDeviceStatistics();
            refreshChartData();
        });
    }

    // Initialize socket connection with reconnection handling
    initializeSocketConnection();

    // Add manual reconnect button to UI
    addSocketReconnectButton();
});

// Initialize socket connection with proper error handling
function initializeSocketConnection() {
    const token = localStorage.getItem('accessToken');
    
    try {
        // Add socket status CSS
        addSocketStatusStyles();
        
        // For better reliability, use the SocketRecovery utility if available
        if (window.socketRecovery) {
            console.log('Using SocketRecovery utility');
            
            window.socketRecovery.init({
                auth: { token: token },
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                transports: ['websocket', 'polling']
            });
            
            socketInstance = window.socketRecovery.socket;
            
            // Set up event handlers through the recovery utility
            window.socketRecovery.options.onConnect = function() {
                console.log('Socket connected successfully');
                socketReconnectAttempts = 0;
                updateSocketConnectionStatus('connected');
            };
            
            window.socketRecovery.options.onDisconnect = function(reason) {
                console.log('Socket disconnected:', reason);
                updateSocketConnectionStatus('disconnected');
            };
            
            window.socketRecovery.options.onError = function(error) {
                console.error('Socket error:', error);
                updateSocketConnectionStatus('error', error.message || 'Connection error');
            };
            
            // Set up message handlers
            setupMessageHandlers(socketInstance);
        } else {
            console.log('SocketRecovery not available, using standard Socket.IO');
            
            // Standard Socket.IO initialization
            socketInstance = io({
                auth: { token: token },
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                transports: ['websocket', 'polling']
            });
            
            // Set up standard event handlers
            setupStandardSocketHandlers(socketInstance);
            
            // Set up message handlers
            setupMessageHandlers(socketInstance);
        }
    } catch (e) {
        console.error('Failed to initialize socket:', e);
        updateSocketConnectionStatus('error', e.message || 'Initialization failed');
    }
}

function setupStandardSocketHandlers(socket) {
    socket.on('connect', function() {
        console.log('Socket connected successfully');
        socketReconnectAttempts = 0;
        clearSocketReconnectTimer();
        updateSocketConnectionStatus('connected');
    });
    
    socket.on('disconnect', function(reason) {
        console.log('Socket disconnected:', reason);
        updateSocketConnectionStatus('disconnected');
        
        // If server disconnected us, try manual reconnection
        if (reason === 'io server disconnect') {
            attemptReconnection();
        }
    });
    
    socket.on('connect_error', function(error) {
        console.error('Socket connection error:', error);
        socketReconnectAttempts++;
        updateSocketConnectionStatus('error', error.message);
        
        // If we've reached max automatic attempts, try manual reconnection
        if (socketReconnectAttempts > 5 && !socketReconnectTimer) {
            console.log('Socket.IO reconnection attempts exhausted, scheduling manual reconnect');
            attemptReconnection(true);
        }
    });
}

function setupMessageHandlers(socket) {
    socket.on('sensor_update', function(data) {
        try {
            console.log('Received sensor update:', data);
            // Update charts with new data
            if (data && data.device_id && typeof updateChartWithNewData === 'function') {
                updateChartWithNewData(data.device_id, data);
            }
            
            // Update device UI
            if (data && data.device_id) {
                updateDeviceUI(data.device_id, data);
            }
        } catch (err) {
            console.error('Error handling sensor update:', err);
        }
    });
    
    socket.on('device_status', function(data) {
        try {
            console.log('Received device status update:', data);
            if (data && data.device_id && data.status) {
                updateDeviceStatus(data.device_id, data.status);
            }
        } catch (err) {
            console.error('Error handling device status update:', err);
        }
    });
}

function attemptReconnection(withDelay = false) {
    // Clear any existing timer
    clearSocketReconnectTimer();
    
    const delay = withDelay ? Math.min(30000, 1000 * Math.pow(1.5, socketReconnectAttempts)) : 100;
    
    console.log(`Scheduling reconnection attempt in ${delay}ms`);
    
    socketReconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect socket...');
        
        if (socketInstance) {
            try {
                // Make sure we're disconnected first
                if (socketInstance.connected) {
                    socketInstance.disconnect();
                }
                
                // Try to reconnect
                socketInstance.connect();
            } catch (e) {
                console.error('Error during reconnection:', e);
                
                // If reconnection failed, try reinitializing
                if (socketReconnectAttempts > 10) {
                    console.log('Too many failed reconnection attempts, reinitializing socket');
                    initializeSocketConnection();
                } else {
                    // Try again after a delay
                    attemptReconnection(true);
                }
            }
        } else {
            // If socketInstance is null, reinitialize
            initializeSocketConnection();
        }
        
        socketReconnectTimer = null;
    }, delay);
}

function clearSocketReconnectTimer() {
    if (socketReconnectTimer) {
        clearTimeout(socketReconnectTimer);
        socketReconnectTimer = null;
    }
}

function addSocketStatusStyles() {
    // Add CSS for socket status indicator if it doesn't exist
    if (!document.getElementById('socket-status-css')) {
        const link = document.createElement('link');
        link.id = 'socket-status-css';
        link.rel = 'stylesheet';
        link.href = '/static/css/socket_status.css';
        document.head.appendChild(link);
    }
}

function updateSocketConnectionStatus(status, errorMessage = '') {
    // Add a connection status indicator if it doesn't exist
    let statusIndicator = document.getElementById('socket-connection-status');
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'socket-connection-status';
        statusIndicator.className = 'socket-status-indicator';
        document.body.appendChild(statusIndicator);
    }
    
    // Update the status indicator
    if (status === 'connected') {
        statusIndicator.className = 'socket-status-indicator connected';
        statusIndicator.setAttribute('title', 'Connected to server');
    } else if (status === 'disconnected') {
        statusIndicator.className = 'socket-status-indicator disconnected';
        statusIndicator.setAttribute('title', 'Disconnected from server');
    } else if (status === 'error') {
        statusIndicator.className = 'socket-status-indicator error';
        statusIndicator.setAttribute('title', `Connection error: ${errorMessage}`);
    }
    
    // Also update any status indicators in the header
    const headerStatus = document.getElementById('connection-status');
    if (headerStatus) {
        if (status === 'connected') {
            headerStatus.className = 'connection-status text-success';
            headerStatus.innerHTML = '<i class="fas fa-plug"></i> <span>Connected</span>';
        } else if (status === 'disconnected') {
            headerStatus.className = 'connection-status text-warning';
            headerStatus.innerHTML = '<i class="fas fa-plug"></i> <span>Disconnected</span>';
        } else if (status === 'error') {
            headerStatus.className = 'connection-status text-danger';
            headerStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Connection Error</span>';
        }
    }
}

function addSocketReconnectButton() {
    // Add a reconnect button if it doesn't exist
    let reconnectBtn = document.getElementById('socket-reconnect-btn');
    if (!reconnectBtn) {
        reconnectBtn = document.createElement('button');
        reconnectBtn.id = 'socket-reconnect-btn';
        reconnectBtn.className = 'btn btn-sm btn-primary socket-reconnect-btn';
        reconnectBtn.innerHTML = '<i class="fas fa-sync"></i> Reconnect';
        reconnectBtn.style.position = 'fixed';
        reconnectBtn.style.bottom = '20px';
        reconnectBtn.style.left = '20px';
        reconnectBtn.style.zIndex = '9999';
        reconnectBtn.style.display = 'none';
        
        reconnectBtn.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-sync fa-spin"></i> Connecting...';
            
            // Try reconnection
            if (window.socketRecovery) {
                window.socketRecovery.reconnect();
            } else if (socketInstance) {
                socketInstance.disconnect();
                socketInstance.connect();
            } else {
                initializeSocketConnection();
            }
            
            // Re-enable after a delay
            setTimeout(() => {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-sync"></i> Reconnect';
            }, 3000);
        });
        
        document.body.appendChild(reconnectBtn);
        
        // Show reconnect button when socket is disconnected for a while
        setInterval(() => {
            if (socketInstance && !socketInstance.connected) {
                reconnectBtn.style.display = 'block';
            } else {
                reconnectBtn.style.display = 'none';
            }
        }, 5000);
    }
}

// Format timestamp for consistent display
function formatTimestamp(timestamp) {
    if (!timestamp) return 'unknown';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        
        if (isNaN(diffMs)) return 'unknown';
        
        const diffSec = Math.floor(diffMs / 1000);
        
        if (diffSec < 60) {
            return 'just now';
        } else if (diffSec < 3600) {
            const minutes = Math.floor(diffSec / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diffSec < 86400) { // 24 hours
            const hours = Math.floor(diffSec / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleString();
        }
    } catch (e) {
        console.error('Error formatting timestamp:', e);
        return 'unknown';
    }
}

// Update device UI with new data
function updateDeviceUI(deviceId, data) {
    if (!deviceId || !data) return;
    
    try {
        // Update value displays
        const valueDisplays = document.querySelectorAll(`.value-display[data-device-id="${deviceId}"]`);
        if (data.value !== undefined && valueDisplays.length > 0) {
            const valueStr = typeof data.value === 'number' ? data.value.toFixed(1) : data.value;
            valueDisplays.forEach(display => {
                display.textContent = valueStr;
            });
        }
        
        // Update last seen timestamps
        const timestamp = data.timestamp || new Date().toISOString();
        const lastSeenElements = document.querySelectorAll(`.last-updated-time[data-device-id="${deviceId}"]`);
        lastSeenElements.forEach(element => {
            element.textContent = formatTimestamp(timestamp);
        });
    } catch (e) {
        console.error('Error updating device UI:', e);
    }
}

function updateDeviceStatus(deviceId, status) {
    if (!deviceId || !status) return;
    
    try {
        // Update status indicators
        const statusIndicators = document.querySelectorAll(`.device-status[data-device-id="${deviceId}"]`);
        statusIndicators.forEach(indicator => {
            indicator.className = `device-status ${status.toLowerCase()}`;
            indicator.setAttribute('data-status', status);
        });
    } catch (e) {
        console.error('Error updating device status:', e);
    }
}

// Setup global error handler to prevent page crashes from socket errors
window.addEventListener('error', function(event) {
    // Check if error is related to WebSockets or Socket.IO
    if (event.message && (
        event.message.includes('WebSocket') || 
        event.message.includes('socket') || 
        event.message.includes('Socket') ||
        event.message.includes('connection')
    )) {
        console.error('Socket error handled:', event.message);
        event.preventDefault();
        
        // Try to recover the connection if it's a socket error
        if (!socketReconnectTimer) {
            attemptReconnection(true);
        }
        
        return true;
    }
});

// Initialize device controls
function initializeDeviceControls() {
    // Setup toggle switches
    const toggleSwitches = document.querySelectorAll('.device-toggle');
    toggleSwitches.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const deviceId = this.getAttribute('data-device-id');
            const action = this.checked ? 'on' : 'off';
            
            controlDevice(deviceId, action);
        });
    });
    
    // Setup control buttons (like thermostats, dimmers, etc)
    const controlButtons = document.querySelectorAll('.device-control-btn');
    controlButtons.forEach(button => {
        button.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            const action = this.getAttribute('data-action');
            const valueInput = document.querySelector(`input[data-device-id="${deviceId}"]`);
            
            let value = null;
            if (valueInput) {
                value = valueInput.value;
            }
            
            controlDevice(deviceId, action, value);
        });
    });
}

function controlDevice(deviceId, action, value = null) {
    if (!deviceId || !action) return;
    
    const token = localStorage.getItem('accessToken');
    if (!token) {
        console.error('No access token available');
        return;
    }
    
    const payload = {
        action: action,
        value: value
    };
    
    fetch(`/api/devices/${deviceId}/control`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`Device ${deviceId} control success:`, data.message);
            // Optional: Show a success message to the user
        } else {
            console.error(`Device ${deviceId} control failed:`, data.message);
            // Handle the error, maybe revert the UI change
        }
    })
    .catch(error => {
        console.error(`Error controlling device ${deviceId}:`, error);
        // Handle the error, maybe revert the UI change
    });
}

function loadDeviceStatistics() {
    console.log('Loading device statistics');
    
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    
    fetch('/api/devices', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateDeviceStatistics(data.devices);
        }
    })
    .catch(error => {
        console.error('Error loading device statistics:', error);
    });
}

function updateDeviceStatistics(devices) {
    if (!devices || !Array.isArray(devices)) return;
    
    // Update device counts
    const totalDevicesEl = document.getElementById('totalDevices');
    const onlineDevicesEl = document.getElementById('onlineDevices');
    const offlineDevicesEl = document.getElementById('offlineDevices');
    
    if (totalDevicesEl) {
        totalDevicesEl.textContent = devices.length;
    }
    
    let onlineCount = 0;
    devices.forEach(device => {
        if (device.status && device.status.toLowerCase() === 'online') {
            onlineCount++;
        }
    });
    
    if (onlineDevicesEl) {
        onlineDevicesEl.textContent = onlineCount;
    }
    
    if (offlineDevicesEl) {
        offlineDevicesEl.textContent = devices.length - onlineCount;
    }
    
    // Update device status indicators
    devices.forEach(device => {
        const deviceEl = document.querySelector(`[data-device-id="${device.device_id}"]`);
        if (deviceEl) {
            const statusIndicator = deviceEl.querySelector('.device-status');
            if (statusIndicator) {
                statusIndicator.className = `device-status ${device.status.toLowerCase()}`;
                statusIndicator.setAttribute('data-status', device.status);
            }
            
            // If device has a value, update it
            if (device.value !== undefined) {
                const valueEl = deviceEl.querySelector('.device-value');
                if (valueEl) {
                    valueEl.textContent = device.value;
                }
            }
            
            // If device has a last_seen timestamp, update it
            if (device.last_seen) {
                const lastSeenEl = deviceEl.querySelector('.device-last-seen');
                if (lastSeenEl) {
                    const date = new Date(device.last_seen);
                    lastSeenEl.textContent = date.toLocaleString();
                }
            }
        }
    });
}

function initializeCharts() {
    // Find all chart containers
    const chartContainers = document.querySelectorAll('[data-chart-device]');
    
    chartContainers.forEach(container => {
        const deviceId = container.getAttribute('data-chart-device');
        const chartType = container.getAttribute('data-chart-type') || 'line';
        
        if (deviceId && container.id) {
            // Load data for this device
            loadDeviceData(deviceId, container.id, chartType);
        }
    });
}

function loadDeviceData(deviceId, containerId, chartType) {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    
    // Default to 1 day of data and 100 data points
    fetch(`/api/devices/${deviceId}/data?days=1&limit=100`, {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            deviceData[deviceId] = data.data;
            createChart(containerId, deviceId, data.data, chartType);
        }
    })
    .catch(error => {
        console.error(`Error loading data for device ${deviceId}:`, error);
    });
}

function createChart(containerId, deviceId, data, chartType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Prepare data for chart
    const labels = [];
    const values = [];
    
    data.forEach(item => {
        const date = new Date(item.timestamp);
        labels.push(date.toLocaleTimeString());
        values.push(item.value);
    });
    
    // Create chart using Chart.js
    if (window.Chart) {
        const ctx = container.getContext('2d');
        
        // Destroy existing chart if it exists
        if (charts[containerId]) {
            charts[containerId].destroy();
        }
        
        charts[containerId] = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: deviceId,
                    data: values,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }
}

function refreshChartData() {
    // Refresh all charts
    for (const deviceId in deviceData) {
        const chartContainers = document.querySelectorAll(`[data-chart-device="${deviceId}"]`);
        chartContainers.forEach(container => {
            if (container.id) {
                const chartType = container.getAttribute('data-chart-type') || 'line';
                loadDeviceData(deviceId, container.id, chartType);
            }
        });
    }
}

// Function that can be called from socket_handler.js to update a chart with new data
function updateChartWithNewData(deviceId, newData) {
    if (!deviceId || !newData || !newData.value) return;
    
    // Find charts for this device
    const chartContainers = document.querySelectorAll(`[data-chart-device="${deviceId}"]`);
    
    chartContainers.forEach(container => {
        if (container.id && charts[container.id]) {
            const chart = charts[container.id];
            
            // Add new data point
            const date = new Date(newData.timestamp || new Date());
            
            // Add to beginning for newest data
            chart.data.labels.unshift(date.toLocaleTimeString());
            chart.data.datasets[0].data.unshift(newData.value);
            
            // Keep only the most recent 100 points
            if (chart.data.labels.length > 100) {
                chart.data.labels.pop();
                chart.data.datasets[0].data.pop();
            }
            
            // Update the chart
            chart.update();
            
            // Also update the device data store
            if (deviceData[deviceId]) {
                deviceData[deviceId].unshift({
                    timestamp: newData.timestamp || new Date().toISOString(),
                    value: newData.value
                });
                
                // Keep only 100 data points
                if (deviceData[deviceId].length > 100) {
                    deviceData[deviceId].pop();
                }
            }
        }
    });
}

// Make this function available globally
window.updateChartWithNewData = updateChartWithNewData;