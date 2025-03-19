/**
 * Socket.IO connection heartbeat utility
 * This script implements a ping mechanism to keep WebSocket connections alive
 * and detect connection issues early
 */

class SocketHeartbeat {
    constructor(options = {}) {
        this.options = {
            pingInterval: 30000,   // Ping every 30 seconds
            pongTimeout: 5000,     // Wait 5 seconds for pong response
            reconnectDelay: 2000,  // Wait 2 seconds before reconnecting
            onConnectionLost: null,
            onConnectionRestored: null,
            debug: false,
            ...options
        };
        
        this.socket = null;
        this.pingInterval = null;
        this.pongTimeout = null;
        this.lastPong = null;
        this.connectionLost = false;
        this.isActive = false;
    }
    
    attach(socket) {
        if (!socket) {
            console.error('Cannot attach heartbeat - socket is null');
            return this;
        }
        
        this.socket = socket;
        this.lastPong = Date.now(); // Initialize last pong time
        
        // Set up pong listener
        socket.on('pong', () => {
            this.lastPong = Date.now();
            
            if (this.options.debug) {
                console.log('Pong received');
            }
            
            // Connection restored if it was lost before
            if (this.connectionLost) {
                this.connectionLost = false;
                
                if (typeof this.options.onConnectionRestored === 'function') {
                    this.options.onConnectionRestored();
                }
            }
        });
        
        // Start heartbeat
        this.start();
        return this;
    }
    
    start() {
        if (!this.socket || this.isActive) return;
        
        this.isActive = true;
        this.lastPong = Date.now();
        
        // Clear any existing intervals
        this.stop();
        
        if (this.options.debug) {
            console.log('Starting socket heartbeat');
        }
        
        // Set up ping interval
        this.pingInterval = setInterval(() => {
            this._sendPing();
        }, this.options.pingInterval);
        
        return this;
    }
    
    stop() {
        this.isActive = false;
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
        
        return this;
    }
    
    _sendPing() {
        if (!this.socket || !this.socket.connected) return;
        
        // Calculate time since last pong
        const timeSinceLastPong = Date.now() - this.lastPong;
        
        // If we haven't received a pong in too long, consider connection lost
        if (timeSinceLastPong > this.options.pingInterval * 2) {
            if (!this.connectionLost) {
                this.connectionLost = true;
                
                console.warn(`Socket connection may be lost (${Math.round(timeSinceLastPong / 1000)}s since last pong)`);
                
                if (typeof this.options.onConnectionLost === 'function') {
                    this.options.onConnectionLost(timeSinceLastPong);
                }
            }
            
            // Try to reconnect the socket
            this._attemptReconnect();
            return;
        }
        
        // Send ping
        try {
            if (this.options.debug) {
                console.log('Sending ping');
            }
            
            this.socket.emit('ping');
            
            // Set pong timeout
            if (this.pongTimeout) {
                clearTimeout(this.pongTimeout);
            }
            
            this.pongTimeout = setTimeout(() => {
                console.warn('Pong timeout - no response to ping');
                
                if (!this.connectionLost) {
                    this.connectionLost = true;
                    
                    if (typeof this.options.onConnectionLost === 'function') {
                        this.options.onConnectionLost(this.options.pongTimeout);
                    }
                    
                    this._attemptReconnect();
                }
            }, this.options.pongTimeout);
        } catch (e) {
            console.error('Error sending ping:', e);
        }
    }
    
    _attemptReconnect() {
        if (!this.socket) return;
        
        // Only attempt reconnection if socket exists and thinks it's connected
        // but we haven't received a pong
        if (this.socket.connected) {
            console.log('Connection appears dead. Attempting to reconnect...');
            try {
                // Clean disconnect and reconnect
                this.socket.disconnect();
                
                // Small delay before reconnecting
                setTimeout(() => {
                    this.socket.connect();
                }, this.options.reconnectDelay);
            } catch (e) {
                console.error('Error during manual reconnection:', e);
            }
        }
    }
}

// Create a global instance
window.socketHeartbeat = new SocketHeartbeat({
    debug: false,  // Set to true to see ping/pong logs
    onConnectionLost: (time) => {
        console.warn(`Connection lost (${Math.round(time/1000)}s since last response)`);
        
        // Update UI to show disconnection
        const statusIndicator = document.getElementById('socket-connection-status');
        if (statusIndicator) {
            statusIndicator.className = 'socket-status-indicator error';
            statusIndicator.setAttribute('title', 'Connection lost - attempting to reconnect');
        }
    },
    onConnectionRestored: () => {
        console.log('Connection restored');
        
        // Update UI to show reconnection
        const statusIndicator = document.getElementById('socket-connection-status');
        if (statusIndicator) {
            statusIndicator.className = 'socket-status-indicator connected';
            statusIndicator.setAttribute('title', 'Connected to server');
        }
    }
});
