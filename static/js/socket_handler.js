// Socket.IO handler for real-time updates
let socket;
let deviceData = {}; // Cache for device data
let lastUpdateTimes = {}; // Cache for last update times
let connectionRetryCount = 0;
let maxRetries = 10;
let reconnectTimer = null;

// Make sure to use the correct token name
const ACCESS_TOKEN_KEY = 'accessToken'; // This should match what's used elsewhere

document.addEventListener('DOMContentLoaded', function() {
    // Delay socket initialization to ensure page is loaded
    setTimeout(() => {
        initializeSocket();
    }, 300);
});

// Initialize Socket.IO connection
function initializeSocket() {
    // Get access token from local storage - use the correct key
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    
    // Prevent errors that could crash the connection
    try {
        // Use an options object with connection settings optimized for stability
        const options = {
            auth: {
                token: accessToken
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: false,
            transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
            upgrade: true,
            rememberUpgrade: true,
            autoConnect: true
        };
        
        // Log connection attempt
        console.log('Initializing Socket.IO connection...');
        
        // Try to connect with error handling
        socket = io(options);
        
        // Connection events
        socket.on('connect', () => {
            console.log('Connected to server');
            updateConnectionStatus('connected');
            connectionRetryCount = 0;
            
            // Clear any pending reconnect timers
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        });
        
        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            updateConnectionStatus('disconnected');
            
            // Handle transport-close more aggressively
            if (reason === 'transport close' || reason === 'ping timeout') {
                // This indicates a problematic connection
                // Schedule manual reconnection with increasing delay
                scheduleManualReconnect();
            }
        });
        
        // Authentication error
        socket.on('connect_error', (err) => {
            console.error('Connection error:', err.message);
            updateConnectionStatus('disconnected');
            
            // If authentication error, redirect to login
            if (err.message === 'Authentication error' || err.message.includes('auth')) {
                showAlert('Authentication failed. Please log in again.', 'danger');
                localStorage.removeItem(ACCESS_TOKEN_KEY);
                // Redirect to login after a delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                // For other types of errors, handle reconnect logic
                handleReconnect();
            }
        });
        
        // Error event (transport-level)
        socket.io.on('error', (error) => {
            console.error('Transport error:', error);
            updateConnectionStatus('error');
            
            // Force reconnect for transport-level errors
            scheduleManualReconnect(true);
        });
        
        // Handle sensor data updates
        socket.on('sensor_update', (data) => {
            try {
                console.log('Sensor update received:', data);
                
                // Only process if data is valid
                if (!data || !data.device_id) {
                    console.error('Invalid sensor data received:', data);
                    return;
                }
                
                const deviceId = data.device_id;
                
                // Update device data cache
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
            } catch (error) {
                // Prevent event handling errors from breaking the connection
                console.error('Error handling sensor update:', error);
            }
        });
        
        // Handle device status updates
        socket.on('device_status', (data) => {
            try {
                console.log('Device status update received:', data);
                
                // Validate data
                if (!data || !data.device_id || !data.status) {
                    console.error('Invalid device status data:', data);
                    return;
                }
                
                const deviceId = data.device_id;
                
                // Update device status indicators
                const statusIndicators = document.querySelectorAll(`.device-status[data-device-id="${deviceId}"]`);
                statusIndicators.forEach(indicator => {
                    // Remove all status classes
                    indicator.classList.remove('status-online', 'status-offline', 'status-error');
                    // Add appropriate class
                    indicator.classList.add(`status-${data.status}`);
                    
                    // Update tooltip if exists
                    if (window.bootstrap && indicator.hasAttribute('data-bs-toggle')) {
                        const tooltip = bootstrap.Tooltip.getInstance(indicator);
                        if (tooltip) {
                            tooltip.setContent({ '.tooltip-inner': `Status: ${data.status}` });
                        }
                    }
                });
                
                // Update status text if exists
                const statusTexts = document.querySelectorAll(`.device-status-text[data-device-id="${deviceId}"]`);
                statusTexts.forEach(element => {
                    element.textContent = data.status;
                });
                
                // Update timestamp if exists
                if (data.timestamp) {
                    const timestamps = document.querySelectorAll(`.device-last-seen[data-device-id="${deviceId}"]`);
                    timestamps.forEach(element => {
                        element.textContent = formatRelativeTime(data.timestamp);
                        element.setAttribute('title', formatDate(data.timestamp));
                    });
                }
            } catch (error) {
                // Prevent event handling errors from breaking the connection
                console.error('Error handling device status update:', error);
            }
        });
        
    } catch (error) {
        // Catch any initialization errors
        console.error('Socket initialization error:', error);
        updateConnectionStatus('error');
    }
}

function handleReconnect() {
    // Increment retry count
    connectionRetryCount++;
    console.log(`Connection attempt ${connectionRetryCount} failed`);
    
    // After several automatic attempts, try manual reconnection
    if (socket && connectionRetryCount > socket.io.opts.reconnectionAttempts) {
        console.log('Automatic reconnection attempts exhausted');
        scheduleManualReconnect();
    }
}

function scheduleManualReconnect(immediate = false) {
    // Clear any existing timer
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    // Calculate delay with exponential backoff
    const delay = immediate ? 100 : Math.min(30000, 1000 * Math.pow(2, Math.min(connectionRetryCount, 10) - 1));
    
    console.log(`Scheduling manual reconnect in ${delay}ms (attempt ${connectionRetryCount})`);
    
    reconnectTimer = setTimeout(() => {
        console.log('Attempting manual reconnection...');
        
        if (socket) {
            // Ensure disconnected state
            if (socket.connected) {
                socket.disconnect();
            }
            
            // Force a refresh of the socket instance
            if (connectionRetryCount > 5) {
                socket.io.engine.close();
                setTimeout(() => socket.connect(), 100);
            } else {
                // Simple reconnect
                socket.connect();
            }
        } else {
            // If socket object is lost, reinitialize
            initializeSocket();
        }
        
        reconnectTimer = null;
    }, delay);
}

// Update UI connection status
function updateConnectionStatus(status) {
    const statusIndicator = document.getElementById('connection-status');
    if (!statusIndicator) return;
    
    // Remove all status classes first
    statusIndicator.classList.remove('text-success', 'text-danger', 'text-warning');
    
    if (status === 'connected') {
        statusIndicator.classList.add('text-success');
        statusIndicator.querySelector('i').className = 'fas fa-circle';
        statusIndicator.querySelector('span').textContent = 'Connected';
    } else if (status === 'disconnected') {
        statusIndicator.classList.add('text-warning');
        statusIndicator.querySelector('i').className = 'fas fa-exclamation-circle';
        statusIndicator.querySelector('span').textContent = 'Disconnected';
    } else if (status === 'error') {
        statusIndicator.classList.add('text-danger');
        statusIndicator.querySelector('i').className = 'fas fa-times-circle';
        statusIndicator.querySelector('span').textContent = 'Connection Error';
    }
    
    // Also update socket status indicator if it exists
    const socketStatusIndicator = document.getElementById('socket-connection-status');
    if (socketStatusIndicator) {
        socketStatusIndicator.className = `socket-status-indicator ${status}`;
    }
}

// Safely reset the socket connection
function resetSocketConnection() {
    if (socket) {
        try {
            socket.disconnect();
        } catch (e) {
            console.error('Error disconnecting socket:', e);
        }
    }
    
    // Reset connection retry count
    connectionRetryCount = 0;
    
    // Clear any pending timers
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    // Attempt to reinitialize after a delay
    setTimeout(() => {
        initializeSocket();
    }, 1000);
}

// Format relative time (e.g., "5 minutes ago")
function formatRelativeTime(timestamp) {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        
        if (isNaN(diffMs)) return 'unknown';
        
        const diffSec = Math.round(diffMs / 1000);
        
        if (diffSec < 60) return 'just now';
        if (diffSec < 3600) return `${Math.round(diffSec / 60)} minute(s) ago`;
        if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hour(s) ago`;
        return `${Math.round(diffSec / 86400)} day(s) ago`;
    } catch (e) {
        console.error('Error formatting relative time:', e);
        return 'unknown';
    }
}

// Format date as a string
function formatDate(timestamp) {
    try {
        return new Date(timestamp).toLocaleString();
    } catch (e) {
        return 'Invalid date';
    }
}

// Expose function to manually reconnect
window.resetSocketConnection = resetSocketConnection;

// Prevent WebSocket errors from crashing the page
window.addEventListener('error', function(event) {
    // Check if the error is related to Socket.IO or WebSocket
    if (event.message && 
        (event.message.includes('websocket') || 
         event.message.includes('socket') || 
         event.message.includes('connection') ||
         event.message.includes('WebSocket'))) {
        console.error('Socket error handled:', event.message);
        event.preventDefault();
        
        // Try to reconnect if it's a socket error
        if (!reconnectTimer && socket) {
            scheduleManualReconnect();
        }
        
        return true;
    }
    return false;
});