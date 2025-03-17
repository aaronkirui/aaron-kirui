document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginAlert = document.getElementById('loginAlert');
    
    // Admin credentials (In production, this would be authenticated via backend)
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'admin';
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        // Clear previous alerts
        loginAlert.style.display = 'none';
        
        // Simple authentication
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            // Store admin session in localStorage
            localStorage.setItem('adminAuthenticated', 'true');
            
            // Redirect to admin dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Show error message
            loginAlert.textContent = 'Invalid username or password';
            loginAlert.style.display = 'block';
            
            // Clear password field
            document.getElementById('password').value = '';
        }
    });
    
    // Check if admin is already logged in
    if (localStorage.getItem('adminAuthenticated') === 'true') {
        window.location.href = 'dashboard.html';
    }
});