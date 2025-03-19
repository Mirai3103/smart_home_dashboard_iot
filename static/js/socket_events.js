// Socket.IO connection management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize socket with reconnection parameters to prevent excessive reconnects
    const socket = io({
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    // Connection events
    socket.on('connect', function() {
        console.log('Connected to server');
    });

    socket.on('disconnect', function() {
        console.log('Disconnected from server');
    });

    // Handle connection errors - prevent infinite reconnection attempts
    socket.on('connect_error', function(error) {
        console.error('Connection error:', error);
        // After multiple failed attempts, stop trying to reconnect
        if (socket.io.reconnectionAttempts >= 5) {
            socket.io.reconnection(false);
            console.log('Stopping reconnection attempts after multiple failures');
        }
    });

    // Add event listeners for other socket events here
    // ...
});
