document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  
  // Initialize popovers
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
  const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
  
  // Current time display
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
  
  // Refresh buttons
  const refreshButtons = document.querySelectorAll('.refresh-button');
  refreshButtons.forEach(button => {
      button.addEventListener('click', function() {
          const targetId = this.getAttribute('data-refresh-target');
          const target = document.getElementById(targetId);
          
          if (target) {
              // Add spinning animation
              this.classList.add('fa-spin');
              
              // Get the data-refresh-url if it exists
              const refreshUrl = this.getAttribute('data-refresh-url');
              if (refreshUrl) {
                  // Fetch new data and update the content
                  fetch(refreshUrl)
                      .then(response => response.json())
                      .then(data => {
                          // Update content based on the response
                          handleRefreshData(target, data);
                          // Stop spinning after a short delay
                          setTimeout(() => {
                              this.classList.remove('fa-spin');
                          }, 500);
                      })
                      .catch(error => {
                          console.error('Error refreshing data:', error);
                          this.classList.remove('fa-spin');
                          showAlert('Error refreshing data. Please try again.', 'danger');
                      });
              } else {
                  // If no URL is provided, just simulate a refresh
                  setTimeout(() => {
                      this.classList.remove('fa-spin');
                  }, 1000);
              }
          }
      });
  });
});

// Update current time display
function updateCurrentTime() {
  const timeElements = document.querySelectorAll('.current-time');
  const now = new Date();
  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  timeElements.forEach(element => {
      element.textContent = formattedTime;
  });
}

// Handle refresh data update
function handleRefreshData(target, data) {
  // Update based on the target and data
  // This function should be customized based on your specific needs
  if (data.success) {
      if (data.devices) {
          // Update devices list
          // Implementation depends on your UI structure
      } else if (data.data) {
          // Update sensor data
          // Implementation depends on your UI structure
      }
  } else {
      showAlert(data.message || 'Error refreshing data', 'danger');
  }
}

// Show an alert message
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) return;
  
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.role = 'alert';
  
  alertElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertElement);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alertElement);
      bsAlert.close();
  }, 5000);
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 0) {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else if (diffHour > 0) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffMin > 0) {
      return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffSec > 10) {
      return `${diffSec} seconds ago`;
  } else {
      return 'just now';
  }
}

// Get appropriate device icon class
function getDeviceIconClass(deviceType) {
  const iconMap = {
      'temperature': 'fa-thermometer-half',
      'humidity': 'fa-tint',
      'light': 'fa-lightbulb',
      'motion': 'fa-running',
      'switch': 'fa-toggle-on',
      'door': 'fa-door-open',
      'window': 'fa-window-maximize',
      'camera': 'fa-video',
      'speaker': 'fa-volume-up',
      'fan': 'fa-fan',
      'thermostat': 'fa-thermometer-full'
  };
  
  return iconMap[deviceType] || 'fa-microchip';
}

// API request helper function
async function apiRequest(url, method = 'GET', data = null) {
  const options = {
      method: method,
      headers: {
          'Content-Type': 'application/json'
      }
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
  }
  
  try {
      const response = await fetch(url, options);
      const result = await response.json();
      
      if (!response.ok) {
          throw new Error(result.message || 'API request failed');
      }
      
      return result;
  } catch (error) {
      console.error('API Request Error:', error);
      showAlert(error.message, 'danger');
      throw error;
  }
}