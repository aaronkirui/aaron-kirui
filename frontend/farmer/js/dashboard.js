// Check authentication
function checkAuth() {
    const token = localStorage.getItem('farmerToken');
    if (!token) {
       window.location.href = 'index.html';
    }
   return token;
}

// Initialize dashboard
async function initializeDashboard() {
    const token = checkAuth();
    
    try {
        // Fetch farmer data
        const response = await fetch('http://localhost:3000/api/farmer/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch farmer data');
        
        const farmerData = await response.json();
        document.getElementById('farmer-name').textContent = farmerData.fullname;
        
        // Load initial data
        await Promise.all([
            loadCurrentPrice(),
            loadDashboardStats(),
            initializeChart(),
            loadSubmissions(),
            loadPayments(),
            loadFeedbackHistory()
        ]);
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        alert('Failed to load dashboard data. Please try again.');
    }
}

// Load current milk price
async function loadCurrentPrice() {
    try {
        const response = await fetch('http://localhost:3000/api/prices/current');
        const data = await response.json();
        document.getElementById('milk-price').textContent = `KES ${data.price}`;
    } catch (error) {
        console.error('Failed to load current price:', error);
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    const token = checkAuth();
    try {
        const response = await fetch('http://localhost:3000/api/farmer/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const stats = await response.json();
        
        document.getElementById('today-submission').textContent = `${stats.todayTotal} L`;
        document.getElementById('month-total').textContent = `${stats.monthTotal} L`;
        document.getElementById('expected-payment').textContent = `KES ${stats.expectedPayment}`;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Initialize submission chart
function initializeChart() {
    const ctx = document.getElementById('milkSubmissionChart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Milk Submissions',
                data: [],
                borderColor: '#4682B4',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Liters'
                    }
                }
            }
        }
    });
    
    return chart;
}

// Load submissions data
async function loadSubmissions(period = 'daily') {
    const token = checkAuth();
    try {
        const response = await fetch(`http://localhost:3000/api/farmer/submissions?period=${period}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const submissions = await response.json();
        
        const tableBody = document.getElementById('submissions-body');
        tableBody.innerHTML = '';
        
        submissions.forEach(submission => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(submission.date).toLocaleDateString()}</td>
                <td>${submission.morning || 0}</td>
                <td>${submission.evening || 0}</td>
                <td>${submission.morning + submission.evening}</td>
                <td>KES ${submission.amount}</td>
            `;
            tableBody.appendChild(row);
        });

        // Update chart if we're on daily view
        if (period === 'daily') {
            updateChart(submissions);
        }
    } catch (error) {
        console.error('Failed to load submissions:', error);
    }
}

// Update chart with new data
function updateChart(submissions) {
    const chart = Chart.getChart('milkSubmissionChart');
    if (chart) {
        chart.data.labels = submissions.map(s => new Date(s.date).toLocaleDateString());
        chart.data.datasets[0].data = submissions.map(s => s.morning + s.evening);
        chart.update();
    }
}

// Load payments history
async function loadPayments() {
    const token = checkAuth();
    try {
        const response = await fetch('http://localhost:3000/api/farmer/payments', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const payments = await response.json();
        
        const tableBody = document.getElementById('payments-body');
        tableBody.innerHTML = '';
        
        payments.forEach(payment => {
            const row = document.createElement('tr');
            row.innerHTML = `
               <td>${payment.id}</td>
      
        <td>${payment.total_liters.toFixed(2)} L</td>
        <td>KES ${payment.rate.toFixed(2)}</td>
        <td>KES ${payment.total_amount.toFixed(2)}</td>
        <td>${new Date(payment.month).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</td>
        <td>
          <span class="status-badge status-${payment.status.toLowerCase()}">
            ${payment.status}
          </span>
        </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load payments:', error);
    }
}

// Load feedback history
async function loadFeedbackHistory() {
    const token = checkAuth();
    try {
        const response = await fetch('http://localhost:3000/api/farmer/feedback', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const feedbackHistory = await response.json();
        
        const historyContainer = document.getElementById('feedback-history');
        historyContainer.innerHTML = '';
        
        feedbackHistory.forEach(feedback => {
            const feedbackElement = document.createElement('div');
            feedbackElement.className = 'feedback-item';
            feedbackElement.innerHTML = `
                <div class="feedback-header">
                    <h4>${feedback.subject}</h4>
                    
                </div>
                <p>${feedback.message}</p>
                ${feedback.response ? `
                    <div class="feedback-response">
                        <strong>Response:</strong>
                        <p>${feedback.response}</p>
                    </div>
                ` : ''}
            `;
            historyContainer.appendChild(feedbackElement);
        });
    } catch (error) {
        console.error('Failed to load feedback history:', error);
    }
}

// Handle feedback submission
document.getElementById('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = checkAuth();
    
    const subject = document.getElementById('feedback-subject').value;
    const message = document.getElementById('feedback-message').value;
    
    try {
        const response = await fetch('http://localhost:3000/api/farmer/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subject, message })
        });
        
        if (response.ok) {
            alert('Feedback submitted successfully!');
            document.getElementById('feedback-form').reset();
            loadFeedbackHistory();
        } else {
            throw new Error('Failed to submit feedback');
        }
    } catch (error) {
        console.error('Feedback submission failed:', error);
        alert('Failed to submit feedback. Please try again.');
    }
});

// Navigation handling
document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all links and sections
        document.querySelectorAll('[data-section]').forEach(el => 
            el.parentElement.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(el => 
            el.classList.remove('active'));
        
        // Add active class to clicked link and corresponding section
        const sectionName = link.dataset.section;
        link.parentElement.classList.add('active');
        document.getElementById(`${sectionName}-section`).classList.add('active');
    });
});

// Handle submission period change
document.getElementById('submission-period').addEventListener('change', (e) => {
    loadSubmissions(e.target.value);
});

// Handle sidebar toggle
document.getElementById('sidebarCollapse').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

// Handle logout
document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('farmerToken');
    window.location.href = 'index.html';
});

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);