// Charts.js for handling all chart visualizations
let deviceCharts = {}; // Store chart instances
let chartData = {}; // Store chart data
const maxDataPoints = 50; // Maximum number of data points to show

document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
});

// Initialize charts on page load
function initializeCharts() {
    // Find all chart containers
    const chartContainers = document.querySelectorAll('.chart-container[data-device-id]');
    
    chartContainers.forEach(container => {
        const deviceId = container.getAttribute('data-device-id');
        const chartType = container.getAttribute('data-chart-type') || 'line';
        const chartCanvas = container.querySelector('canvas');
        
        if (chartCanvas) {
            createDeviceChart(deviceId, chartCanvas, chartType);
            
            // Load initial data
            const dataUrl = container.getAttribute('data-chart-url');
            if (dataUrl) {
                loadHistoricalData(deviceId, dataUrl);
            }
        }
    });
    
    // Initialize the dashboard overview chart if it exists
    const overviewChartContainer = document.getElementById('overview-chart');
    if (overviewChartContainer) {
        initializeOverviewChart(overviewChartContainer);
    }
}

// Create a chart for a specific device
function createDeviceChart(deviceId, canvas, chartType = 'line') {
    // Define default datasets based on device type
    let datasets = [];
    const deviceType = canvas.getAttribute('data-device-type');
    
    if (deviceType === 'temperature') {
        datasets = [{
            label: 'Temperature',
            data: [],
            borderColor: 'rgb(231, 76, 60)',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }];
    } else if (deviceType === 'humidity') {
        datasets = [{
            label: 'Humidity',
            data: [],
            borderColor: 'rgb(52, 152, 219)',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }];
    } else if (deviceType === 'light') {
        datasets = [{
            label: 'Light Level',
            data: [],
            borderColor: 'rgb(243, 156, 18)',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }];
    } else {
        datasets = [{
            label: 'Value',
            data: [],
            borderColor: 'rgb(46, 204, 113)',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            borderWidth: 2,
            tension: 0.2,
            fill: true
        }];
    }
    
    // Initialize chart data
    chartData[deviceId] = {
        labels: [],
        datasets: datasets
    };
    
    // Chart configuration
    const config = {
        type: chartType,
        data: chartData[deviceId],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 10
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        tooltipFormat: 'HH:mm:ss',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: getYAxisTitle(deviceType)
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animation: {
                duration: 300
            }
        }
    };
    
    // Create and store the chart
    deviceCharts[deviceId] = new Chart(canvas, config);
    
    return deviceCharts[deviceId];
}

// Get Y-axis title based on device type
function getYAxisTitle(deviceType) {
    switch(deviceType) {
        case 'temperature':
            return 'Temperature (°C)';
        case 'humidity':
            return 'Humidity (%)';
        case 'light':
            return 'Light Level (lux)';
        default:
            return 'Value';
    }
}

// Load historical data for a device
function loadHistoricalData(deviceId, url) {
    // Show loading indicator if exists
    const chartContainer = document.querySelector(`.chart-container[data-device-id="${deviceId}"]`);
    if (chartContainer) {
        const loadingIndicator = chartContainer.querySelector('.chart-loading');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('d-none');
        }
    }
    
    // Fetch data from API
    fetch(url)
        .then(response => response.json())
        .then(result => {
            if (result.success && result.data && result.data.length > 0) {
                // Process and add data to chart
                const data = result.data;
                
                // Clear existing data
                chartData[deviceId].labels = [];
                chartData[deviceId].datasets[0].data = [];
                
                // Add data points (limited to maxDataPoints)
                const pointsToAdd = Math.min(data.length, maxDataPoints);
                for (let i = 0; i < pointsToAdd; i++) {
                    const point = data[data.length - 1 - i]; // Start from the most recent
                    
                    // Add data point
                    chartData[deviceId].labels.unshift(new Date(point.timestamp));
                    chartData[deviceId].datasets[0].data.unshift(point.value);
                }
                
                // Update chart
                deviceCharts[deviceId].update();
            }
        })
        .catch(error => {
            console.error('Error loading historical data:', error);
        })
        .finally(() => {
            // Hide loading indicator
            const chartContainer = document.querySelector(`.chart-container[data-device-id="${deviceId}"]`);
            if (chartContainer) {
                const loadingIndicator = chartContainer.querySelector('.chart-loading');
                if (loadingIndicator) {
                    loadingIndicator.classList.add('d-none');
                }
            }
        });
}

// Update a device chart with new data
function updateDeviceChart(deviceId, data) {
    if (!deviceCharts[deviceId] || !chartData[deviceId]) return;
    
    // Add new data point
    const timestamp = new Date(data.timestamp);
    chartData[deviceId].labels.push(timestamp);
    chartData[deviceId].datasets[0].data.push(parseFloat(data.value));
    
    // Limit number of data points
    if (chartData[deviceId].labels.length > maxDataPoints) {
        chartData[deviceId].labels.shift();
        chartData[deviceId].datasets[0].data.shift();
    }
    
    // Update chart
    deviceCharts[deviceId].update();
}

// Initialize the overview chart on the dashboard
function initializeOverviewChart(container) {
    const canvas = container.querySelector('canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Data structure
    const data = {
        labels: [],
        datasets: [
            {
                label: 'Living Room Temp',
                data: [],
                borderColor: 'rgb(231, 76, 60)',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.2,
                yAxisID: 'y1'
            },
            {
                label: 'Bedroom Temp',
                data: [],
                borderColor: 'rgb(241, 196, 15)',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.2,
                yAxisID: 'y1'
            },
            {
                label: 'Living Room Humidity',
                data: [],
                borderColor: 'rgb(52, 152, 219)',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.2,
                yAxisID: 'y2',
                hidden: true
            },
            {
                label: 'Bedroom Humidity',
                data: [],
                borderColor: 'rgb(155, 89, 182)',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.2,
                yAxisID: 'y2',
                hidden: true
            }
        ]
    };
    
    // Generate 24 hours of sample data (for demo purposes)
    const now = new Date();
    for (let i = 24; i >= 0; i--) {
        const time = new Date(now - i * 3600000);
        data.labels.push(time);
        
        // Generate realistic looking data
        const hourOfDay = time.getHours();
        const baseTemp = 22; // Base temperature
        const basehum = 50;  // Base humidity
        
        // Temperature varies by time of day
        const tempVariation = Math.sin((hourOfDay - 14) * Math.PI / 12) * 3;
        const humVariation = -Math.sin((hourOfDay - 14) * Math.PI / 12) * 5;
        
        // Add some random noise
        const livingRoomTemp = baseTemp + tempVariation + (Math.random() - 0.5) * 0.8;
        const bedroomTemp = baseTemp + tempVariation * 0.7 + (Math.random() - 0.5) * 0.6;
        const livingRoomHum = basehum + humVariation + (Math.random() - 0.5) * 2;
        const bedroomHum = basehum + humVariation * 1.2 + (Math.random() - 0.5) * 2;
        
        // Add data to datasets
        data.datasets[0].data.push(livingRoomTemp);
        data.datasets[1].data.push(bedroomTemp);
        data.datasets[2].data.push(livingRoomHum);
        data.datasets[3].data.push(bedroomHum);
    }
    
    // Chart configuration
    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: {
                            hour: 'HH:mm'
                        }
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    };
    
    // Create chart
    const chart = new Chart(ctx, config);
    
    // Add to charts collection
    deviceCharts['overview'] = chart;
    
    return chart;
}