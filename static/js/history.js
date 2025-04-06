/**
 * history.js - Handles the data history functionality
 */

// Chart instance
let historyChart = null;
let historyData = [];

document.addEventListener('DOMContentLoaded', function() {
    // Set default date range (last 7 days)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    document.getElementById('dateFrom').valueAsDate = lastWeek;
    document.getElementById('dateTo').valueAsDate = today;
    
    // View toggle
    document.getElementById('view-chart').addEventListener('click', function() {
        document.getElementById('chartView').style.display = 'block';
        document.getElementById('tableView').style.display = 'none';
        this.classList.add('active');
        document.getElementById('view-table').classList.remove('active');
    });
    
    document.getElementById('view-table').addEventListener('click', function() {
        document.getElementById('chartView').style.display = 'none';
        document.getElementById('tableView').style.display = 'block';
        this.classList.add('active');
        document.getElementById('view-chart').classList.remove('active');
    });
    
    // Chart type toggle
    const chartTypeButtons = document.querySelectorAll('[data-chart-type]');
    chartTypeButtons.forEach(button => {
        button.addEventListener('click', function() {
            chartTypeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update chart type if data is loaded
            if (historyChart) {
                historyChart.config.type = this.getAttribute('data-chart-type');
                historyChart.update();
            }
        });
    });
    
    // Load data button click
    document.getElementById('loadData').addEventListener('click', function() {
        loadHistoricalData();
    });
    
    // Export data button click
    document.getElementById('exportData').addEventListener('click', function() {
        exportData();
    });
    
    // Reset filters button click
    document.getElementById('resetFilters').addEventListener('click', function() {
        document.getElementById('deviceSelect').value = '';
        document.getElementById('dateFrom').valueAsDate = lastWeek;
        document.getElementById('dateTo').valueAsDate = today;
        document.getElementById('dataType').value = 'all';
        document.getElementById('dataResolution').value = 'raw';
        document.getElementById('dataLimit').value = '100';
        
        // Hide no data placeholder
        document.getElementById('noDataPlaceholder').style.display = 'none';
        
        // Show views
        document.getElementById('chartView').style.display = 'block';
        document.getElementById('tableView').style.display = 'none';
        document.getElementById('view-chart').classList.add('active');
        document.getElementById('view-table').classList.remove('active');
    });
    
    // Table search
    document.getElementById('tableSearch').addEventListener('keyup', function() {
        const searchText = this.value.toLowerCase();
        const table = document.getElementById('dataTable');
        const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.getElementsByTagName('td');
            let found = false;
            
            for (let j = 0; j < cells.length; j++) {
                const cellText = cells[j].textContent.toLowerCase();
                if (cellText.indexOf(searchText) > -1) {
                    found = true;
                    break;
                }
            }
            
            if (found) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
    
    // Check if device is specified in URL
    const urlParams = new URLSearchParams(window.location.search);
    const deviceParam = urlParams.get('device');
    
    if (deviceParam) {
        // Set device in dropdown
        const deviceSelect = document.getElementById('deviceSelect');
        if (deviceSelect) {
            for (let i = 0; i < deviceSelect.options.length; i++) {
                if (deviceSelect.options[i].value === deviceParam) {
                    deviceSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        // Auto-load data for selected device
        setTimeout(loadHistoricalData, 500);
    }
});

/**
 * Load historical data from the API
 */
function loadHistoricalData() {
    const deviceId = document.getElementById('deviceSelect').value || 'all';
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const dataType = document.getElementById('dataType').value;
    const resolution = document.getElementById('dataResolution').value;
    const limit = document.getElementById('dataLimit').value;
    
    // Show loading indicator
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('chartView').style.display = 'none';
    document.getElementById('tableView').style.display = 'none';
    document.getElementById('noDataPlaceholder').style.display = 'none';
    
    // Build URL
    let url = `/api/devices/${deviceId}/data?limit=${limit}`;
    
    if (dateFrom) {
        url += `&from=${dateFrom}`;
    }
    
    if (dateTo) {
        url += `&to=${dateTo}`;
    }
    
    if (dataType !== 'all') {
        url += `&type=${dataType}`;
    }
    
    if (resolution !== 'raw') {
        url += `&resolution=${resolution}`;
    }
    
    // Fetch data
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            document.getElementById('loadingIndicator').style.display = 'none';
            
            if (data.success && data.data && data.data.length > 0) {
                // Store data globally
                historyData = data.data;
                
                // Show view based on selected tab
                if (document.getElementById('view-chart').classList.contains('active')) {
                    document.getElementById('chartView').style.display = 'block';
                } else {
                    document.getElementById('tableView').style.display = 'block';
                }
                
                // Update chart
                updateChart(data.data);
                
                // Update table
                updateTable(data.data);
                
                // Update statistics
                updateStatistics(data.data);
                
                // Update URL with selected device
                if (deviceId !== 'all') {
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('device', deviceId);
                    window.history.replaceState({}, '', newUrl);
                }
            } else {
                // Show no data placeholder
                document.getElementById('noDataPlaceholder').style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('noDataPlaceholder').style.display = 'block';
            
            // Show error toast
            showToast('Error loading data. Please try again.', 'danger');
        });
}

/**
 * Update chart with data
 * @param {Array} data - The data to display
 */
function updateChart(data) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    // Prepare data by device and type
    const chartDatasets = [];
    const deviceGroups = {};
    
    // Group data by device and type
    data.forEach(item => {
        const key = `${item.device_id}_${item.type}`;
        if (!deviceGroups[key]) {
            deviceGroups[key] = {
                device_id: item.device_id,
                device_name: item.device_name || item.device_id,
                type: item.type,
                unit: item.unit || '',
                data: []
            };
        }
        
        // Convert string timestamp to Date object if needed
        const timestamp = typeof item.timestamp === 'string' ? 
            new Date(item.timestamp) : item.timestamp;
        
        deviceGroups[key].data.push({
            x: timestamp,
            y: parseFloat(item.value)
        });
    });
    
    // Create datasets
    Object.values(deviceGroups).forEach((group, index) => {
        // Determine color based on type
        let color;
        if (group.type === 'temperature') {
            color = 'rgb(231, 76, 60)';
        } else if (group.type === 'humidity') {
            color = 'rgb(52, 152, 219)';
        } else if (group.type === 'light') {
            color = 'rgb(243, 156, 18)';
        } else {
            // Generate color based on index
            const hue = (index * 137) % 360;
            color = `hsl(${hue}, 70%, 50%)`;
        }
        
        // Sort data points by timestamp
        group.data.sort((a, b) => a.x - b.x);
        
        chartDatasets.push({
            label: `${group.device_name} (${group.type})`,
            data: group.data,
            borderColor: color,
            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
            borderWidth: 2,
            tension: 0.2,
            fill: false,
            pointRadius: 3
        });
    });
    
    // Create or update chart
    if (historyChart) {
        historyChart.data.datasets = chartDatasets;
        historyChart.update();
    } else {
        // Get selected chart type
        const chartType = document.querySelector('[data-chart-type].active').getAttribute('data-chart-type');
        
        historyChart = new Chart(ctx, {
            type: chartType,
            data: {
                datasets: chartDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: {
                                hour: 'MMM d, HH:mm'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Value'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toFixed(2);
                                const unit = deviceGroups[label.split(' (')[0] + '_' + label.split(' (')[1].replace(')', '')].unit;
                                return `${label}: ${value} ${unit}`;
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            usePointStyle: true
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
}

/**
 * Update table with data
 * @param {Array} data - The data to display
 */
function updateTable(data) {
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <p class="text-muted">No data available</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort data by timestamp (newest first)
    data.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
    });
    
    // Add rows to table
    data.forEach(item => {
        const row = document.createElement('tr');
        
        // Format date
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleString();
        
        // Create type badge
        const typeBadge = getTypeLabel(item.type);
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${item.device_name || item.device_id}</td>
            <td>${typeBadge}</td>
            <td>${parseFloat(item.value).toFixed(2)}</td>
            <td>${item.unit || ''}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update pagination if needed
    updatePagination(data.length);
}

/**
 * Update pagination controls
 * @param {number} totalItems - Total number of items
 */
function updatePagination(totalItems) {
    const pagination = document.getElementById('tablePagination');
    const itemsPerPage = 25; // Number of items to show per page
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    pagination.innerHTML = '';
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item disabled';
    prevLi.innerHTML = '<a class="page-link" href="#" tabindex="-1">Previous</a>';
    pagination.appendChild(prevLi);
    
    // Page buttons (show max 5 pages)
    const maxButtons = 5;
    const startPage = 1;
    const endPage = Math.min(totalPages, maxButtons);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = i === 1 ? 'page-item active' : 'page-item';
        pageLi.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        pagination.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = 'page-item';
    nextLi.innerHTML = '<a class="page-link" href="#">Next</a>';
    pagination.appendChild(nextLi);
    
    // Add click handlers for pagination
    const pageLinks = pagination.querySelectorAll('.page-link');
    pageLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Handle previous/next
            if (this.innerText === 'Previous') {
                const activePage = parseInt(pagination.querySelector('.page-item.active .page-link').getAttribute('data-page'));
                if (activePage > 1) {
                    changePage(activePage - 1);
                }
            } else if (this.innerText === 'Next') {
                const activePage = parseInt(pagination.querySelector('.page-item.active .page-link').getAttribute('data-page'));
                if (activePage < totalPages) {
                    changePage(activePage + 1);
                }
            } else {
                // Handle specific page
                changePage(parseInt(this.getAttribute('data-page')));
            }
        });
    });
    
    // Function to change page
    function changePage(pageNum) {
        // Update active class
        pagination.querySelectorAll('.page-item').forEach(item => {
            if (item.querySelector('.page-link') && item.querySelector('.page-link').getAttribute('data-page') == pageNum) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Update previous/next buttons
        if (pageNum === 1) {
            prevLi.classList.add('disabled');
        } else {
            prevLi.classList.remove('disabled');
        }
        
        if (pageNum === totalPages) {
            nextLi.classList.add('disabled');
        } else {
            nextLi.classList.remove('disabled');
        }
        
        // Update table to show only the current page items
        const startIdx = (pageNum - 1) * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, historyData.length);
        
        updateTable(historyData.slice(startIdx, endIdx));
    }
}

/**
 * Update statistics display
 * @param {Array} data - The data to calculate statistics from
 */
function updateStatistics(data) {
    if (data.length === 0) return;
    
    // Check if we're using aggregated data (with min/max already calculated)
    if (data[0].min !== undefined && data[0].max !== undefined) {
        // For aggregated data, find overall min/max/avg
        let globalMin = Number.MAX_VALUE;
        let globalMax = Number.MIN_VALUE;
        let sum = 0;
        let count = 0;
        
        data.forEach(item => {
            globalMin = Math.min(globalMin, item.min);
            globalMax = Math.max(globalMax, item.max);
            sum += item.value * (item.count || 1);
            count += (item.count || 1);
        });
        
        const avg = sum / count;
        
        // Use unit from first item
        const unit = data[0].unit || '';
        
        // Update statistics display
        document.getElementById('stat-min').textContent = `${globalMin.toFixed(1)}${unit}`;
        document.getElementById('stat-max').textContent = `${globalMax.toFixed(1)}${unit}`;
        document.getElementById('stat-avg').textContent = `${avg.toFixed(1)}${unit}`;
        document.getElementById('stat-count').textContent = count;
        
        return;
    }
    
    // For raw data, calculate statistics
    const deviceGroups = {};
    
    // Group by device and type to avoid mixing different metrics
    data.forEach(item => {
        const key = `${item.device_id}_${item.type}`;
        if (!deviceGroups[key]) {
            deviceGroups[key] = {
                type: item.type,
                unit: item.unit || '',
                values: []
            };
        }
        
        deviceGroups[key].values.push(parseFloat(item.value));
    });
    
    // If we have multiple device types, use the first one for stats
    // (we could enhance this to switch between device types)
    const firstGroup = Object.values(deviceGroups)[0];
    
    if (firstGroup) {
        const values = firstGroup.values;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const unit = firstGroup.unit;
        
        // Update statistics display
        document.getElementById('stat-min').textContent = `${min.toFixed(1)}${unit}`;
        document.getElementById('stat-max').textContent = `${max.toFixed(1)}${unit}`;
        document.getElementById('stat-avg').textContent = `${avg.toFixed(1)}${unit}`;
        document.getElementById('stat-count').textContent = values.length;
    }
}

/**
 * Export data as CSV
 */
function exportData() {
    if (!historyData || historyData.length === 0) {
        showToast('No data to export. Please load data first.', 'warning');
        return;
    }
    
    // Get device name
    const deviceId = document.getElementById('deviceSelect').value;
    const deviceSelect = document.getElementById('deviceSelect');
    const deviceName = deviceId && deviceId !== 'all' ? 
        deviceSelect.options[deviceSelect.selectedIndex].text : 'All Devices';
    
    // Get date range
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,Device,Type,Value,Unit\n';
    
    // Add data rows
    historyData.forEach(item => {
        const timestamp = new Date(item.timestamp).toISOString();
        csvContent += `${timestamp},"${item.device_name || item.device_id}","${item.type}",${item.value},"${item.unit || ''}"\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smart_home_data_${deviceId || 'all'}_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    
    // Show success toast
    showToast('Data exported successfully!', 'success');
}

/**
 * Helper function to get type label
 * @param {string} type - The sensor type
 * @returns {string} HTML for badge
 */
function getTypeLabel(type) {
    switch (type) {
        case 'temperature':
            return '<span class="badge bg-danger"><i class="fas fa-thermometer-half me-1"></i> Temperature</span>';
        case 'humidity':
            return '<span class="badge bg-info"><i class="fas fa-tint me-1"></i> Humidity</span>';
        case 'light':
            return '<span class="badge bg-warning"><i class="fas fa-lightbulb me-1"></i> Light</span>';
        case 'pressure':
            return '<span class="badge bg-secondary"><i class="fas fa-compress-alt me-1"></i> Pressure</span>';
        case 'air_quality':
            return '<span class="badge bg-success"><i class="fas fa-wind me-1"></i> Air Quality</span>';
        case 'co2':
            return '<span class="badge bg-dark"><i class="fas fa-cloud me-1"></i> CO2</span>';
        case 'noise':
            return '<span class="badge bg-primary"><i class="fas fa-volume-up me-1"></i> Noise</span>';
        default:
            return `<span class="badge bg-secondary"><i class="fas fa-microchip me-1"></i> ${type}</span>`;
    }
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, danger, warning, info)
 */
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.id = toastId;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toastEl);
    
    // Initialize and show toast
    const toast = new bootstrap.Toast(toastEl, {
        autohide: true,
        delay: 5000
    });
    toast.show();
    
    // Remove from DOM after it's hidden
    toastEl.addEventListener('hidden.bs.toast', function() {
        this.remove();
    });
}
