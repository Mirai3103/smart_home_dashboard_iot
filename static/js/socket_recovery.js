/**
 * Socket.IO connection recovery and management utility
 */

class SocketRecovery {
    constructor(options = {}) {
        this.socket = null;
        this.options = {
            maxRetries: 10,
            initialDelay: 1000,
            maxDelay: 30000,
            factor: 1.5,
            jitter: 0.1,
            onConnect: null,
            onDisconnect: null,
            onError: null,
            onReconnectAttempt: null,
            onMaxRetriesExceeded: null,
            ...options
        };
        
        this.retryCount = 0;
        this.reconnectTimer = null;
        this.connected = false;
        this.handlers = new Map();
    }
    
    init(socketIoOptions = {}) {
        // Clean up any existing connection
        this.cleanup();
        
        // Default Socket.IO options with our recovery settings
        const defaultOptions = {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: this.options.initialDelay,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            transports: ['websocket', 'polling']
        };
        
        try {
            // Initialize Socket.IO with merged options
            this.socket = io({...defaultOptions, ...socketIoOptions});
            
            // Set up core event handlers
            this._setupEventHandlers();
            
            return this.socket;
        } catch (error) {
            console.error('Failed to initialize Socket.IO:', error);
            if (typeof this.options.onError === 'function') {
                this.options.onError(error);
            }
            return null;
        }
    }
    
    _setupEventHandlers() {
        if (!this.socket) return;
        
        // Handle connection
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.connected = true;
            this.retryCount = 0;
            
            // Clear any pending timers
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Call user provided callback
            if (typeof this.options.onConnect === 'function') {
                this.options.onConnect();
            }
        });
        
        // Handle disconnection
        this.socket.on('disconnect', (reason) => {
            console.log(`Socket disconnected: ${reason}`);
            this.connected = false;
            
            if (typeof this.options.onDisconnect === 'function') {
                this.options.onDisconnect(reason);
            }
            
            // Handle specific reconnection cases
            if (reason === 'io server disconnect') {
                // Server has closed the connection, need to reconnect manually
                this._scheduleReconnect();
            }
            // For all other cases, Socket.IO will handle reconnection automatically
        });
        
        // Handle connection errors
        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            
            if (typeof this.options.onError === 'function') {
                this.options.onError(error);
            }
            
            // If Socket.IO's built-in reconnection fails, we handle it ourselves
            if (this.retryCount >= this.socket.io.opts.reconnectionAttempts) {
                this._scheduleReconnect();
            }
        });
        
        // Handle errors
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            
            if (typeof this.options.onError === 'function') {
                this.options.onError(error);
            }
        });
    }
    
    _scheduleReconnect() {
        // Don't schedule if we're already reconnecting or have reached max retries
        if (this.reconnectTimer || this.retryCount >= this.options.maxRetries) {
            if (this.retryCount >= this.options.maxRetries) {
                console.log(`Exceeded maximum reconnection attempts (${this.options.maxRetries})`);
                if (typeof this.options.onMaxRetriesExceeded === 'function') {
                    this.options.onMaxRetriesExceeded(this.retryCount);
                }
            }
            return;
        }
        
        this.retryCount++;
        
        // Calculate delay with exponential backoff and jitter
        let delay = Math.min(
            this.options.maxDelay,
            this.options.initialDelay * Math.pow(this.options.factor, this.retryCount - 1)
        );
        
        // Add jitter to prevent thundering herd problem
        if (this.options.jitter > 0) {
            const jitterAmount = delay * this.options.jitter;
            delay = delay - jitterAmount + (Math.random() * jitterAmount * 2);
        }
        
        console.log(`Scheduling reconnection attempt ${this.retryCount} in ${Math.round(delay)}ms`);
        
        if (typeof this.options.onReconnectAttempt === 'function') {
            this.options.onReconnectAttempt(this.retryCount, delay);
        }
        
        this.reconnectTimer = setTimeout(() => {
            console.log(`Attempting reconnection (${this.retryCount}/${this.options.maxRetries})`);
            this.reconnectTimer = null;
            
            if (this.socket) {
                // Ensure we're disconnected before reconnecting
                if (this.socket.connected) {
                    this.socket.disconnect();
                }
                // Try to reconnect
                this.socket.connect();
            } else {
                // Socket was destroyed, recreate it
                this.init();
            }
        }, delay);
    }
    
    on(event, handler) {
        if (!this.socket) return this;
        
        // Store the handler for potential reattachment
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);
        
        // Attach to the socket
        this.socket.on(event, handler);
        return this;
    }
    
    off(event, handler) {
        if (!this.socket) return this;
        
        // Remove from our handler store
        if (this.handlers.has(event)) {
            const handlers = this.handlers.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
        
        // Remove from socket
        this.socket.off(event, handler);
        return this;
    }
    
    emit(event, ...args) {
        if (!this.socket) return false;
        
        try {
            this.socket.emit(event, ...args);
            return true;
        } catch (error) {
            console.error(`Error emitting event ${event}:`, error);
            return false;
        }
    }
    
    reconnect() {
        if (this.connected) {
            this.socket.disconnect();
        }
        
        // Reset retry count to make sure we get a fresh set of attempts
        this.retryCount = 0;
        
        // Try to reconnect immediately
        if (this.socket) {
            this.socket.connect();
        } else {
            this.init();
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    
    cleanup() {
        // Clear any pending timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Disconnect and clean up existing socket
        if (this.socket) {
            try {
                this.socket.disconnect();
                this.socket.removeAllListeners();
                this.socket = null;
            } catch (e) {
                console.error('Error during socket cleanup:', e);
            }
        }
        
        this.connected = false;
    }
    
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }
}

// Create a global instance
window.socketRecovery = new SocketRecovery();
