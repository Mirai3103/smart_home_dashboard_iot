document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize device data and charts
    fetchDevices();
    initializeCharts();
    setupEventListeners();
    formatTimestamps();
});

// Global variables
let deviceData = [];
let deviceTypesChart = null;
let deviceLocationsChart = null;
let deviceStatusChart = null;

// Fetch devices from API
function fetchDevices() {
    fetch('/api/user/devices')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                deviceData = data.devices;
                console.log('Devices fetched successfully:', deviceData);
                updateDeviceStatusIndicators();
                updateDeviceCharts();
                populateDevicesTable(); // Add this line to populate the table
            } else {
                console.error('Error fetching devices:', data.message);
            }
        })
        .catch(error => {
            console.error('Failed to fetch devices:', error);
        });
}

// Add this new function to populate the devices table
function populateDevicesTable() {
    const tableBody = document.querySelector('table.table tbody');
    if (!tableBody) {
        console.error('Table body element not found');
        return;
    }

    // Clear existing rows
    tableBody.innerHTML = '';

    // Check if we have device data
    if (!deviceData || deviceData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="alert alert-info">
                        No devices found. Add a device to get started.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Add each device to the table
    deviceData.forEach(device => {
        // Format the last seen date
        const lastSeen = device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never';
        
        // Create device type badge
        let typeBadge = '';
        if (device.type === 'temperature') {
            typeBadge = `<span class="badge bg-danger"><i class="fas fa-thermometer-half me-1"></i> Temperature</span>`;
        } else if (device.type === 'humidity') {
            typeBadge = `<span class="badge bg-info"><i class="fas fa-tint me-1"></i> Humidity</span>`;
        } else if (device.type === 'light') {
            typeBadge = `<span class="badge bg-warning"><i class="fas fa-lightbulb me-1"></i> Light</span>`;
        } else {
            typeBadge = `<span class="badge bg-secondary"><i class="fas fa-microchip me-1"></i> ${device.type ? device.type.charAt(0).toUpperCase() + device.type.slice(1) : 'Unknown'}</span>`;
        }
        
        // Create location badge
        let locationBadge = '';
        if (device.location === 'living_room') {
            locationBadge = `<span class="badge bg-primary"><i class="fas fa-couch me-1"></i> Living Room</span>`;
        } else if (device.location === 'bedroom') {
            locationBadge = `<span class="badge bg-info"><i class="fas fa-bed me-1"></i> Bedroom</span>`;
        } else if (device.location === 'kitchen') {
            locationBadge = `<span class="badge bg-success"><i class="fas fa-utensils me-1"></i> Kitchen</span>`;
        } else if (device.location) {
            const formattedLocation = device.location
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            locationBadge = `<span class="badge bg-secondary">${formattedLocation}</span>`;
        } else {
            locationBadge = `<span class="badge bg-secondary">Unknown</span>`;
        }
        
        // Create row HTML
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="device-status status-${device.status || 'offline'}" 
                      data-device-id="${device.device_id}"
                      data-bs-toggle="tooltip" 
                      data-bs-placement="top"
                      title="Status: ${device.status || 'offline'}"></span>
            </td>
            <td>${device.name || 'Unnamed Device'}</td>
            <td><code>${device.device_id}</code></td>
            <td>${typeBadge}</td>
            <td>${locationBadge}</td>
            <td>
                <span class="badge bg-success"><i class="fas fa-user me-1"></i> You</span>
            </td>
            <td>
                <span class="device-last-seen" 
                      data-device-id="${device.device_id}"
                      data-timestamp="${device.last_seen}">
                    ${lastSeen}
                </span>
            </td>
            <td>
                <button
                    type="button"
                    class="btn btn-outline-info btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#deviceDetailsModal"
                    data-device-id="${device.device_id}"
                >
                    <i class="fas fa-info-circle"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Reinitialize tooltips for newly added elements
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Format the timestamps to relative time
    formatTimestamps();
}

// Add function to prepare delete device modal
function prepareDeleteDevice(deviceId, deviceName) {
    // Set device information in the delete modal
    document.getElementById('deleteDeviceName').textContent = deviceName || 'Unknown Device';
    document.getElementById('deleteDeviceId').textContent = deviceId;
    
    // Show the modal
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteDeviceModal'));
    deleteModal.show();
}

// Update device status indicators
function updateDeviceStatusIndicators() {
    const statusElements = document.querySelectorAll('.device-status');
    statusElements.forEach(element => {
        const deviceId = element.getAttribute('data-device-id');
        const device = deviceData.find(d => d.device_id === deviceId);
        if (device) {
            element.classList.remove('status-online', 'status-offline', 'status-error');
            element.classList.add(`status-${device.status}`);
            element.setAttribute('title', `Status: ${device.status}`);
        }
    });
}

// Format relative timestamps for last seen
function formatTimestamps() {
    const timestampElements = document.querySelectorAll('.device-last-seen');
    timestampElements.forEach(element => {
        const timestamp = element.getAttribute('data-timestamp');
        if (timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            let timeAgo;
            if (diffDays > 0) {
                timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
                timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else if (diffMins > 0) {
                timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            } else {
                timeAgo = 'Just now';
            }
            
            element.innerHTML = timeAgo;
            element.setAttribute('title', new Date(timestamp).toLocaleString());
        }
    });
}

// Setup event listeners for modals and buttons
function setupEventListeners() {
    // Device Details Modal
    const deviceDetailsModal = document.getElementById('deviceDetailsModal');
    if (deviceDetailsModal) {
        deviceDetailsModal.addEventListener('show.bs.modal', function(event) {
            const button = event.relatedTarget;
            const deviceId = button.getAttribute('data-device-id');
            loadDeviceDetails(deviceId);
        });
    }

    // Share Device Modal
    const shareDeviceModal = document.getElementById('shareDeviceModal');
    if (shareDeviceModal) {
        shareDeviceModal.addEventListener('show.bs.modal', function(event) {
            const button = event.relatedTarget;
            const deviceId = button.getAttribute('data-device-id');
            document.getElementById('shareDeviceId').value = deviceId;
            loadCurrentShares(deviceId);
        });
    }

    // Share Device Submit Button
    const shareDeviceSubmitBtn = document.getElementById('shareDeviceSubmit');
    if (shareDeviceSubmitBtn) {
        shareDeviceSubmitBtn.addEventListener('click', shareDevice);
    }

    // Add Device Modal Submit Button
    const saveNewDeviceBtn = document.getElementById('saveNewDevice');
    if (saveNewDeviceBtn) {
        saveNewDeviceBtn.addEventListener('click', addNewDevice);
    }

    // Edit Device Modal Submit Button
    const updateDeviceBtn = document.getElementById('updateDevice');
    if (updateDeviceBtn) {
        updateDeviceBtn.addEventListener('click', updateDeviceSettings);
    }

    // Delete Device Confirm Button
    const confirmDeleteDeviceBtn = document.getElementById('confirmDeleteDevice');
    if (confirmDeleteDeviceBtn) {
        confirmDeleteDeviceBtn.addEventListener('click', deleteDevice);
    }

    // View Device History Button
    const viewDeviceHistoryBtn = document.getElementById('viewDeviceHistory');
    if (viewDeviceHistoryBtn) {
        viewDeviceHistoryBtn.addEventListener('click', function() {
            const deviceId = document.getElementById('detailDeviceId').textContent;
            window.location.href = `/history?device_id=${deviceId}`;
        });
    }

    // Edit Device Modal
    const editDeviceModal = document.getElementById('editDeviceModal');
    if (editDeviceModal) {
        editDeviceModal.addEventListener('show.bs.modal', function(event) {
            const button = event.relatedTarget;
            const deviceId = button.getAttribute('data-device-id');
            const device = deviceData.find(d => d.device_id === deviceId);
            
            if (device) {
                document.getElementById('editDeviceId').value = device.device_id;
                document.getElementById('editDeviceName').value = device.name || '';
                document.getElementById('editDeviceActive').checked = device.is_active || false;
                
                // Set location dropdown
                const locationSelect = document.getElementById('editDeviceLocation');
                if (locationSelect) {
                    // Try to find the matching option
                    const options = locationSelect.options;
                    for (let i = 0; i < options.length; i++) {
                        if (options[i].value === device.location) {
                            locationSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        });
    }
}

// Initialize charts
function initializeCharts() {
    // Device Types Chart
    const deviceTypesCtx = document.getElementById('deviceTypesChart')?.getContext('2d');
    if (deviceTypesCtx) {
        deviceTypesChart = new Chart(deviceTypesCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#dc3545', // Danger/Red - Temperature
                        '#17a2b8', // Info/Blue - Humidity
                        '#ffc107', // Warning/Yellow - Light
                        '#6c757d', // Secondary/Gray - Other
                        '#28a745'  // Success/Green - Switch
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }

    // Device Locations Chart
    const deviceLocationsCtx = document.getElementById('deviceLocationsChart')?.getContext('2d');
    if (deviceLocationsCtx) {
        deviceLocationsChart = new Chart(deviceLocationsCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#007bff', // Primary/Blue - Living Room
                        '#17a2b8', // Info/Blue - Bedroom
                        '#28a745', // Success/Green - Kitchen
                        '#6c757d', // Secondary/Gray - Other
                        '#fd7e14'  // Orange - Bathroom
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }

    // Device Status Chart
    const deviceStatusCtx = document.getElementById('deviceStatusChart')?.getContext('2d');
    if (deviceStatusCtx) {
        deviceStatusChart = new Chart(deviceStatusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Online', 'Offline', 'Error'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        '#28a745', // Success/Green - Online
                        '#6c757d', // Secondary/Gray - Offline
                        '#dc3545'  // Danger/Red - Error
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }
}

// Update charts with device data
function updateDeviceCharts() {
    if (!deviceData.length) return;
    
    // Update Device Types Chart
    if (deviceTypesChart) {
        const typeCount = {};
        deviceData.forEach(device => {
            typeCount[device.type] = (typeCount[device.type] || 0) + 1;
        });
        
        const labels = Object.keys(typeCount).map(type => {
            // Capitalize and format type names
            return type.charAt(0).toUpperCase() + type.slice(1);
        });
        const data = Object.values(typeCount);
        
        deviceTypesChart.data.labels = labels;
        deviceTypesChart.data.datasets[0].data = data;
        deviceTypesChart.update();
    }
    
    // Update Device Locations Chart
    if (deviceLocationsChart) {
        const locationCount = {};
        deviceData.forEach(device => {
            // Skip devices with undefined location
            if (!device.location) {
                return;
            }
            
            // Format location names from snake_case to Title Case
            const locationName = device.location
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            locationCount[locationName] = (locationCount[locationName] || 0) + 1;
        });
        
        const labels = Object.keys(locationCount);
        const data = Object.values(locationCount);
        
        deviceLocationsChart.data.labels = labels;
        deviceLocationsChart.data.datasets[0].data = data;
        deviceLocationsChart.update();
    }
    
    // Update Device Status Chart
    if (deviceStatusChart) {
        const statusCount = {
            online: 0,
            offline: 0,
            error: 0
        };
        
        deviceData.forEach(device => {
            if (device.status in statusCount) {
                statusCount[device.status]++;
            } else {
                statusCount.offline++;
            }
        });
        
        deviceStatusChart.data.datasets[0].data = [
            statusCount.online,
            statusCount.offline,
            statusCount.error
        ];
        deviceStatusChart.update();
    }
}

// Load device details for the modal
function loadDeviceDetails(deviceId) {
    // Show loading spinner
    document.getElementById('detailDeviceId').textContent = deviceId;
    document.getElementById('detailDeviceName').textContent = 'Loading...';
    document.getElementById('detailDeviceType').textContent = 'Loading...';
    document.getElementById('detailDeviceLocation').textContent = 'Loading...';
    document.getElementById('detailDeviceStatus').textContent = 'Loading...';
    document.getElementById('detailDeviceLastSeen').textContent = 'Loading...';
    document.getElementById('detailDeviceFirmware').textContent = 'Loading...';
    document.getElementById('detailDeviceMac').textContent = 'Loading...';
    document.getElementById('detailDeviceIp').textContent = 'Loading...';
    
    // Add additional fields
    const additionalFields = ['model', 'manufacturer', 'serial_number', 'installed_date', 'power_consumption', 'connection_type'];
    additionalFields.forEach(field => {
        const element = document.getElementById(`detailDevice${field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`);
        if (element) element.textContent = 'Loading...';
    });
    
    fetch(`/api/devices/${deviceId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const device = data.device;
                
                // Basic information
                document.getElementById('detailDeviceId').textContent = device.device_id;
                document.getElementById('detailDeviceName').textContent = device.name || 'Unnamed Device';
                document.getElementById('detailDeviceType').textContent = formatDeviceType(device.type);
                document.getElementById('detailDeviceLocation').textContent = formatLocation(device.location);
                
                // Status with color coding
                const statusElement = document.getElementById('detailDeviceStatus');
                statusElement.textContent = device.status.charAt(0).toUpperCase() + device.status.slice(1);
                statusElement.className = ''; // Reset classes
                if (device.status === 'online') {
                    statusElement.classList.add('text-success');
                } else if (device.status === 'offline') {
                    statusElement.classList.add('text-secondary');
                } else if (device.status === 'error') {
                    statusElement.classList.add('text-danger');
                }
                
                // Format last seen with relative time
                const lastSeenElement = document.getElementById('detailDeviceLastSeen');
                if (device.last_seen) {
                    const lastSeen = new Date(device.last_seen);
                    const now = new Date();
                    const diffMs = now - lastSeen;
                    const diffMins = Math.floor(diffMs / 60000);
                    
                    if (diffMins < 60) {
                        lastSeenElement.textContent = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
                    } else if (diffMins < 1440) {
                        const diffHours = Math.floor(diffMins / 60);
                        lastSeenElement.textContent = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                    } else {
                        const diffDays = Math.floor(diffMins / 1440);
                        lastSeenElement.textContent = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                    }
                    
                    lastSeenElement.setAttribute('title', lastSeen.toLocaleString());
                } else {
                    lastSeenElement.textContent = 'Never';
                }
                
                // Technical details
                document.getElementById('detailDeviceFirmware').textContent = device.firmware_version || 'N/A';
                document.getElementById('detailDeviceMac').textContent = device.mac_address || 'N/A';
                document.getElementById('detailDeviceIp').textContent = device.ip_address || 'N/A';
                
                // Additional device information if available
                additionalFields.forEach(field => {
                    const element = document.getElementById(`detailDevice${field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`);
                    if (element) {
                        if (field === 'installed_date' && device[field]) {
                            element.textContent = new Date(device[field]).toLocaleDateString();
                        } else if (field === 'power_consumption' && device[field]) {
                            element.textContent = `${device[field]} watts`;
                        } else {
                            element.textContent = device[field] || 'N/A';
                        }
                    }
                });
                
                // Update modal title with device name
                document.getElementById('deviceDetailsModalLabel').innerHTML = 
                    `<i class="fas fa-info-circle me-2"></i>${device.name || 'Device'} Details`;
                
                loadDeviceReadings(deviceId);
                loadDeviceActivity(deviceId);
                loadDeviceChart(deviceId, device.type);
            } else {
                console.error('Error fetching device details:', data.message);
                document.getElementById('detailDeviceName').textContent = 'Error loading device';
            }
        })
        .catch(error => {
            console.error('Error loading device details:', error);
            document.getElementById('detailDeviceName').textContent = 'Error loading device';
        });
}

// Load current device readings
function loadDeviceReadings(deviceId) {
    const readingsContainer = document.getElementById('deviceReadings');
    
    fetch(`/api/devices/${deviceId}/data?limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data.length > 0) {
                const latestReading = data.data[0];
                const device = deviceData.find(d => d.device_id === deviceId);
                
                let readingsHTML = '<div class="current-readings">';
                
                if (device) {
                    if (device.type === 'temperature') {
                        readingsHTML += `
                            <div class="text-center">
                                <h3 class="display-4 text-danger">${latestReading.value}°C</h3>
                                <p class="text-muted">Temperature</p>
                            </div>
                        `;
                    } else if (device.type === 'humidity') {
                        readingsHTML += `
                            <div class="text-center">
                                <h3 class="display-4 text-info">${latestReading.value}%</h3>
                                <p class="text-muted">Humidity</p>
                            </div>
                        `;
                    } else if (device.type === 'light') {
                        readingsHTML += `
                            <div class="text-center">
                                <h3 class="display-4 text-warning">${latestReading.value} lux</h3>
                                <p class="text-muted">Light Intensity</p>
                            </div>
                        `;
                    } else if (device.type === 'switch') {
                        const state = parseInt(latestReading.value) > 0 ? 'ON' : 'OFF';
                        const stateClass = state === 'ON' ? 'text-success' : 'text-secondary';
                        readingsHTML += `
                            <div class="text-center">
                                <h3 class="display-4 ${stateClass}">${state}</h3>
                                <p class="text-muted">Switch State</p>
                            </div>
                        `;
                    } else {
                        readingsHTML += `
                            <div class="text-center">
                                <h3 class="display-4">${latestReading.value}</h3>
                                <p class="text-muted">Current Value</p>
                            </div>
                        `;
                    }
                }
                
                readingsHTML += `
                    <div class="text-center mt-3">
                        <small class="text-muted">Last updated: ${new Date(latestReading.timestamp).toLocaleString()}</small>
                    </div>
                </div>`;
                
                readingsContainer.innerHTML = readingsHTML;
            } else {
                readingsContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No recent readings available for this device.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading device readings:', error);
            readingsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load device readings.
                </div>
            `;
        });
}

// Load device activity history
function loadDeviceActivity(deviceId) {
    const activityContainer = document.getElementById('deviceActivity');
    
    // This endpoint would need to be implemented in your backend
    fetch(`/api/devices/${deviceId}/activity?limit=5`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.activities && data.activities.length > 0) {
                let activityHTML = '<div class="list-group">';
                
                data.activities.forEach(activity => {
                    const timestamp = new Date(activity.timestamp).toLocaleString();
                    let iconClass = 'fas fa-info-circle text-primary';
                    
                    if (activity.action === 'on' || activity.action === 'off') {
                        iconClass = activity.action === 'on' ? 'fas fa-toggle-on text-success' : 'fas fa-toggle-off text-secondary';
                    } else if (activity.action === 'set') {
                        iconClass = 'fas fa-sliders-h text-warning';
                    }
                    
                    activityHTML += `
                        <div class="list-group-item list-group-item-action">
                            <div class="d-flex w-100 justify-content-between">
                                <h6 class="mb-1">
                                    <i class="${iconClass} me-2"></i>
                                    ${formatActivityAction(activity.action, activity.value)}
                                </h6>
                                <small>${timestamp}</small>
                            </div>
                            <small class="text-muted">By ${activity.user_name || 'System'}</small>
                        </div>
                    `;
                });
                
                activityHTML += '</div>';
                activityContainer.innerHTML = activityHTML;
            } else {
                activityContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No recent activity for this device.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading device activity:', error);
            activityContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load device activity.
                </div>
            `;
        });
}

// Load device chart with historical data
function loadDeviceChart(deviceId, deviceType) {
    const chartContainer = document.getElementById('deviceDetailsChart');
    if (!chartContainer) return;
    
    fetch(`/api/devices/${deviceId}/data?days=1&limit=24`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data.length > 0) {
                const chartData = data.data.reverse(); // Reverse to get chronological order
                
                const timestamps = chartData.map(item => {
                    const date = new Date(item.timestamp);
                    return date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0');
                });
                
                const values = chartData.map(item => item.value);
                
                let yAxisLabel = '';
                let borderColor = '#007bff';
                
                if (deviceType === 'temperature') {
                    yAxisLabel = 'Temperature (°C)';
                    borderColor = '#dc3545'; // Red
                } else if (deviceType === 'humidity') {
                    yAxisLabel = 'Humidity (%)';
                    borderColor = '#17a2b8'; // Info blue
                } else if (deviceType === 'light') {
                    yAxisLabel = 'Light (lux)';
                    borderColor = '#ffc107'; // Warning yellow
                } else {
                    yAxisLabel = 'Value';
                }
                
                const ctx = chartContainer.querySelector('canvas').getContext('2d');
                
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: timestamps,
                        datasets: [{
                            label: yAxisLabel,
                            data: values,
                            borderColor: borderColor,
                            backgroundColor: borderColor + '20', // Add transparency
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: deviceType !== 'temperature',
                                title: {
                                    display: true,
                                    text: yAxisLabel
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Time'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                });
            } else {
                chartContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        No historical data available for this device.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading device chart data:', error);
            chartContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load chart data.
                </div>
            `;
        });
}

// Load current shares for device
function loadCurrentShares(deviceId) {
    const sharesContainer = document.getElementById('currentShares');
    
    fetch(`/api/devices/${deviceId}/shares`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.shares && data.shares.length > 0) {
                let sharesHTML = '<ul class="list-group">';
                
                data.shares.forEach(share => {
                    sharesHTML += `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <span>${share.user_email}</span>
                                ${share.can_edit ? '<span class="badge bg-info ms-2">Can Edit</span>' : ''}
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-danger remove-share-btn" 
                                    data-device-id="${deviceId}" data-user-id="${share.user_id}">
                                <i class="fas fa-times"></i>
                            </button>
                        </li>
                    `;
                });
                
                sharesHTML += '</ul>';
                sharesContainer.innerHTML = sharesHTML;
                
                // Add event listeners to remove share buttons
                document.querySelectorAll('.remove-share-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        removeDeviceShare(
                            this.getAttribute('data-device-id'),
                            this.getAttribute('data-user-id')
                        );
                    });
                });
            } else {
                sharesContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        This device is not shared with anyone.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading device shares:', error);
            sharesContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load sharing information.
                </div>
            `;
        });
}

// Share device with another user
function shareDevice() {
    const deviceId = document.getElementById('shareDeviceId').value;
    const email = document.getElementById('shareWithEmail').value;
    const allowEdit = document.getElementById('allowEdit').checked;
    
    if (!email) {
        alert('Please enter an email address');
        return;
    }
    
    fetch('/api/devices/share', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            device_id: deviceId,
            email: email,
            can_edit: allowEdit
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Clear the form
            document.getElementById('shareWithEmail').value = '';
            document.getElementById('allowEdit').checked = false;
            
            // Reload the shares list
            loadCurrentShares(deviceId);
            
            // Show success message
            alert('Device shared successfully with ' + email);
        } else {
            alert('Failed to share device: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error sharing device:', error);
        alert('Failed to share device. Please try again.');
    });
}

// Remove device share
function removeDeviceShare(deviceId, userId) {
    if (!confirm('Are you sure you want to remove this share?')) {
        return;
    }
    
    fetch('/api/devices/unshare', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            device_id: deviceId,
            user_id: userId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the shares list
            loadCurrentShares(deviceId);
        } else {
            alert('Failed to remove share: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error removing device share:', error);
        alert('Failed to remove share. Please try again.');
    });
}

// Add new device
function addNewDevice() {
    const deviceId = document.getElementById('deviceId').value;
    const deviceName = document.getElementById('deviceName').value;
    const deviceType = document.getElementById('deviceType').value;
    const deviceLocation = document.getElementById('deviceLocation').value;
    
    if (!deviceId || !deviceName || !deviceType || !deviceLocation) {
        alert('Please fill in all fields');
        return;
    }
    
    fetch('/api/devices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            device_id: deviceId,
            name: deviceName,
            type: deviceType,
            location: deviceLocation
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addDeviceModal'));
            modal.hide();
            
            // Refresh the devices list
            window.location.reload();
        } else {
            alert('Failed to add device: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error adding device:', error);
        alert('Failed to add device. Please try again.');
    });
}

// Update device settings
function updateDeviceSettings() {
    const deviceId = document.getElementById('editDeviceId').value;
    const deviceName = document.getElementById('editDeviceName').value;
    const deviceActive = document.getElementById('editDeviceActive').checked;
    const deviceLocation = document.getElementById('editDeviceLocation').value;
    
    if (!deviceName || !deviceLocation) {
        alert('Please fill in all required fields');
        return;
    }
    
    fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: deviceName,
            is_active: deviceActive,
            location: deviceLocation
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editDeviceModal'));
            modal.hide();
            
            // Refresh the devices list
            window.location.reload();
        } else {
            alert('Failed to update device: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error updating device:', error);
        alert('Failed to update device. Please try again.');
    });
}

// Delete device
function deleteDevice() {
    const deviceId = document.getElementById('deleteDeviceId').textContent;
    
    fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteDeviceModal'));
            modal.hide();
            
            // Refresh the devices list
            window.location.reload();
        } else {
            alert('Failed to delete device: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error deleting device:', error);
        alert('Failed to delete device. Please try again.');
    });
}

// Helper functions for formatting
function formatDeviceType(type) {
    if (!type) return 'Unknown';
    
    const typeFormatMap = {
        'temperature': 'Temperature Sensor',
        'humidity': 'Humidity Sensor',
        'light': 'Light Sensor',
        'switch': 'Switch',
        'motion': 'Motion Sensor'
    };
    
    return typeFormatMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function formatLocation(location) {
    if (!location) return 'Unknown';
    
    return location
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatActivityAction(action, value) {
    switch (action) {
        case 'on':
            return 'Turned ON';
        case 'off':
            return 'Turned OFF';
        case 'set':
            return `Set value to ${value}`;
        case 'create':
            return 'Device created';
        case 'update':
            return 'Settings updated';
        case 'delete':
            return 'Device deleted';
        case 'share':
            return 'Device shared';
        case 'unshare':
            return 'Sharing removed';
        default:
            return action.charAt(0).toUpperCase() + action.slice(1);
    }
}

// Set interval to refresh data periodically
setInterval(function() {
    fetchDevices();
    formatTimestamps();
}, 60000); // Refresh every minute
