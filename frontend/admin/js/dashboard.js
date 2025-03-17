document.addEventListener('DOMContentLoaded', function() {
    // Check if admin is authenticated
    if (localStorage.getItem('adminAuthenticated') !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    
    // Handle sidebar toggle
    const toggleBtn = document.querySelector('.toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    
    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });
    
    // Handle logout
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminToken');
        window.location.href = 'index.html';
    });
    
    // Fetch and display dashboard data
    fetchDashboardData();
    
    // Initialize charts
    initializeCharts();
    
    // Update activity list
    fetchRecentActivity();
    
    // Handle collection period change
    const collectionPeriod = document.getElementById('collectionPeriod');
    collectionPeriod.addEventListener('change', function() {
        fetchCollectionData(this.value);
    });
});

// Get the API base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Get authentication token from local storage
function getAuthToken() {
    return localStorage.getItem('adminToken');
}

// Helper function for API calls
async function fetchFromAPI(endpoint, options = {}) {
    const token = getAuthToken();
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...defaultOptions,
        ...options
    });
    
    if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
    }
    
    return await response.json();
}

// Fetch dashboard data
async function fetchDashboardData() {
    try {
        // Fetch data in parallel
        const [priceData, farmersCount, todayCollection] = await Promise.all([
            fetchFromAPI('/prices/current'),
            fetchFromAPI('/admin/farmers/count'),
            fetchFromAPI('/admin/milk-submissions/today'),
       
        ]);
        
        const dashboardData = {
            todayCollection: todayCollection.total || 0,
            totalFarmers: farmersCount.count || 0,
            currentPrice: priceData.price || 0,
            priceLastUpdated: priceData.updatedAt || new Date().toISOString(),
            
        };
        
        updateDashboardStats(dashboardData);
        
        // Also fetch initial chart data
        fetchCollectionData('month');
        fetchTopFarmers();
      
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        showErrorMessage('Failed to load dashboard data');
    }
}



// Update dashboard statistics
function updateDashboardStats(data) {
    document.getElementById('todayCollection').textContent = `${data.todayCollection.toFixed(1)} L`;
    document.getElementById('totalFarmers').textContent = data.totalFarmers;
    document.getElementById('currentPrice').textContent = `KES ${data.currentPrice.toFixed(2)}/L`;
    
    // Format date for price last updated
    const priceDate = new Date(data.priceLastUpdated);
    const today = new Date();
    const isToday = priceDate.toDateString() === today.toDateString();
    document.getElementById('priceLastUpdated').textContent = isToday ? 'Today' : formatDate(priceDate);
    
    
}

// Fetch collection data based on period
async function fetchCollectionData(period) {
    try {
        const response = await fetchFromAPI(`/admin/milk-submissions/stats?period=${period}`);
        updateCollectionChart(period, response.data);
    } catch (error) {
        console.error('Error fetching collection data:', error);
        showErrorMessage('Failed to load collection data');
    }
}

// Fetch top farmers data
async function fetchTopFarmers() {
    try {
        const response = await fetchFromAPI('/admin/farmers/top');
        updateTopFarmersChart(response.farmers);
    } catch (error) {
        console.error('Error fetching top farmers:', error);
        showErrorMessage('Failed to load top farmers data');
    }
}


// Fetch recent activity
async function fetchRecentActivity() {
    try {
        const response = await fetchFromAPI('/admin/activities/recent');
        updateActivityList(response.activities);
    } catch (error) {
        console.error('Error fetching recent activities:', error);
        showErrorMessage('Failed to load recent activities');
        // Fall back to empty list
        updateActivityList([]);
    }
}

// Initialize charts with empty data (will be populated later)
function initializeCharts() {
    // Collection Trend Chart
    const collectionCtx = document.getElementById('collectionChart').getContext('2d');
    const collectionChart = new Chart(collectionCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Morning Collection (L)',
                data: [],
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.3,
                fill: true
            }, {
                label: 'Evening Collection (L)',
                data: [],
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
    
    // Top Farmers Chart
    const farmersCtx = document.getElementById('farmersChart').getContext('2d');
    const farmersChart = new Chart(farmersCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Milk Supplied (L)',
                data: [],
                backgroundColor: [
                    'rgba(33, 150, 243, 0.8)',
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(156, 39, 176, 0.8)',
                    'rgba(244, 67, 54, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    
    
    // Store charts for later updates
    window.dashboardCharts = {
        collectionChart,
        farmersChart,
       
    };
}

// Update collection chart with real data
function updateCollectionChart(period, data) {
    const chart = window.dashboardCharts.collectionChart;
    
    if (!data || !data.length) {
        return;
    }
    
    // Extract dates and values from the API response
    const labels = data.map(item => formatDateFromAPI(item.date));
    const morningData = data.map(item => item.morning || 0);
    const eveningData = data.map(item => item.evening || 0);
    
    chart.data.labels = labels;
    chart.data.datasets[0].data = morningData;
    chart.data.datasets[1].data = eveningData;
    chart.update();
}

// Update top farmers chart with real data
function updateTopFarmersChart(farmers) {
    const chart = window.dashboardCharts.farmersChart;
    
    if (!farmers || !farmers.length) {
        return;
    }
    
    const labels = farmers.map(farmer => farmer.fullname || `Farmer ${farmer.id}`);
    const data = farmers.map(farmer => farmer.total || 0);
    
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
}

// Update revenue chart with real data
function updateRevenueChart(distribution) {
    const chart = window.dashboardCharts.revenueChart;
    
    if (!distribution) {
        return;
    }
    
    const data = [
        distribution.farmerPayments || 0,
        distribution.operationalCosts || 0,
        distribution.marketing || 0,
        distribution.profit || 0
    ];
    
    chart.data.datasets[0].data = data;
    chart.update();
}

// Update activity list with real data
function updateActivityList(activities = []) {
    const activityList = document.getElementById('activityList');
    activityList.innerHTML = ''; // Clear existing items
    
    // If no activities, show a message
    if (!activities.length) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.innerHTML = '<p>No recent activities to show</p>';
        activityList.appendChild(emptyMessage);
        return;
    }
    
    activities.forEach(activity => {
        // Determine icon based on activity type
        let icon = 'fa-bell';
        if (activity.type === 'milk_submission') icon = 'fa-fill-drip';
        else if (activity.type === 'registration') icon = 'fa-user-plus';
        else if (activity.type === 'price_update') icon = 'fa-tag';
        else if (activity.type === 'payment') icon = 'fa-credit-card';
        else if (activity.type === 'feedback') icon = 'fa-comment';
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-message">${activity.message}</div>
                <div class="activity-time">${formatTimeAgo(activity.createdAt)}</div>
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
}

// Helper: Format date to MM/DD
function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

// Helper: Format date from API (ISO string format)
function formatDateFromAPI(dateString) {
    const date = new Date(dateString);
    return formatDate(date);
}

// Helper: Format time ago for activities
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay > 0) {
        return diffDay === 1 ? 'Yesterday' : `${diffDay} days ago`;
    } else if (diffHour > 0) {
        return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    } else if (diffMin > 0) {
        return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    } else {
        return 'Just now';
    }
}

// Show error message to user
function showErrorMessage(message) {
    // You could implement a toast notification system here
    console.error(message);
    
    // Simple alert if no UI notification system
    // alert(message);
}