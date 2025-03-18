// Dashboard specific functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize device controls
  initializeDeviceControls();
  
  // Initialize room filter
  initializeRoomFilter();
  
  // Periodically update relative times
  setInterval(updateRelativeTimes, 60000); // Update every minute
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