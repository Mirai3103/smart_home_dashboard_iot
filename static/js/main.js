/**
 * Main JavaScript file for Smart Home Dashboard
 * Contains global utilities and initialization logic
 */

// Use IIFE to avoid global namespace pollution
(function() {
    // Global variables
    let mqttClient = null;  // Initialize once, avoid redeclaring
    let mqttConnected = false;
    let mqttTopics = [];
    let deviceData = {};

    // Initialize when the document is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Main script initialized');
        
        // Initialize components based on page
        initPageComponents();
        
        // Setup MQTT if available
        if (typeof mqtt !== 'undefined') {
            initMqttClient();
        }
    });
    
    // Initialize different components based on current page
    function initPageComponents() {
        // Check which page we're on based on body classes or URL
        const path = window.location.pathname;
        
        if (path === '/' || path.includes('dashboard')) {
            console.log('Dashboard page detected');
            // Dashboard specific initializations
        } else if (path.includes('devices')) {
            console.log('Devices page detected');
            // Devices page specific initializations
        } else if (path.includes('history')) {
            console.log('History page detected');
            // History page specific initializations
        }
    }
    
    // Initialize MQTT client with proper error handling
    function initMqttClient() {
        try {
            if (mqttClient) {
                console.log('MQTT client already exists, not reinitializing');
                return;
            }
            
            console.log('Initializing MQTT client');
            
            // Get authentication token if available
            const token = localStorage.getItem('accessToken');
            
            // MQTT client options
            const options = {
                clean: true,
                connectTimeout: 5000,
                clientId: 'web_' + Math.random().toString(16).substr(2, 8),
                username: token || 'guest',
                password: token || 'guest',
            };
            
            // Connect to broker using WebSocket
            const brokerUrl = 'wss://' + window.location.hostname + ':9001';
            mqttClient = mqtt.connect(brokerUrl, options);
            
            // Set up event handlers
            mqttClient.on('connect', onMqttConnect);
            mqttClient.on('error', onMqttError);
            mqttClient.on('message', onMqttMessage);
            mqttClient.on('offline', onMqttOffline);
            
            // Expose MQTT client to window for debugging only in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                window.debugMqttClient = mqttClient; // For debugging only
            }
            
        } catch (error) {
            console.error('Failed to initialize MQTT client:', error);
            // Make sure we don't leave a partially initialized client
            mqttClient = null;
        }
    }
    
    function onMqttConnect() {
        console.log('MQTT client connected');
        mqttConnected = true;
        
        // Subscribe to saved topics
        if (mqttTopics.length > 0) {
            mqttTopics.forEach(topic => {
                mqttClient.subscribe(topic, {qos: 1});
            });
            console.log('Subscribed to saved topics:', mqttTopics);
        }
        
        // Dispatch event for other components to know MQTT is ready
        document.dispatchEvent(new CustomEvent('mqtt_connected'));
    }
    
    function onMqttError(error) {
        console.error('MQTT client error:', error);
        mqttConnected = false;
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('mqtt_error', {
            detail: { error: error }
        }));
    }
    
    function onMqttMessage(topic, message) {
        try {
            const payload = message.toString();
            console.log('MQTT message received:', topic, payload);
            
            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(payload);
            } catch (e) {
                data = { value: payload };
            }
            
            // Store in device data cache
            const topicParts = topic.split('/');
            if (topicParts.length >= 4) {
                const deviceType = topicParts[3];
                const location = topicParts[2];
                const deviceId = `${deviceType}_${location}`;
                
                if (!deviceData[deviceId]) {
                    deviceData[deviceId] = [];
                }
                
                // Add timestamp if not present
                if (!data.timestamp) {
                    data.timestamp = new Date().toISOString();
                }
                
                // Store data
                deviceData[deviceId].unshift(data);
                
                // Keep only latest 100 entries
                if (deviceData[deviceId].length > 100) {
                    deviceData[deviceId].pop();
                }
                
                // Dispatch event for components that need to know about this update
                document.dispatchEvent(new CustomEvent('mqtt_data_update', {
                    detail: { 
                        topic: topic,
                        deviceId: deviceId,
                        data: data
                    }
                }));
            }
        } catch (e) {
            console.error('Error processing MQTT message:', e);
        }
    }
    
    function onMqttOffline() {
        console.log('MQTT client offline');
        mqttConnected = false;
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('mqtt_disconnected'));
    }
    
    // Safe subscribe function (can be called before connection is established)
    function mqttSubscribe(topic) {
        // Save topic for reconnection
        if (mqttTopics.indexOf(topic) === -1) {
            mqttTopics.push(topic);
        }
        
        // Subscribe if already connected
        if (mqttClient && mqttConnected) {
            mqttClient.subscribe(topic, {qos: 1});
            console.log('Subscribed to MQTT topic:', topic);
        } else {
            console.log('Topic queued for subscription:', topic);
        }
    }
    
    // Safe publish function
    function mqttPublish(topic, message, options = {}) {
        if (!mqttClient || !mqttConnected) {
            console.error('Cannot publish: MQTT client not connected');
            return false;
        }
        
        try {
            // Convert object to string if needed
            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }
            
            // Default options
            const publishOptions = {
                qos: 1,
                retain: false,
                ...options
            };
            
            mqttClient.publish(topic, message, publishOptions);
            return true;
        } catch (e) {
            console.error('Error publishing MQTT message:', e);
            return false;
        }
    }
    
    // Expose functions to global scope (safely)
    window.smartHome = window.smartHome || {};
    window.smartHome.mqtt = {
        subscribe: mqttSubscribe,
        publish: mqttPublish,
        isConnected: () => mqttConnected,
        getDeviceData: (deviceId) => deviceData[deviceId] || []
    };
})();