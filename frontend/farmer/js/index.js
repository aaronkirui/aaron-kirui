// Function to toggle between login and registration forms
function toggleForm(formType) {
    const loginForm = document.querySelector('.login-form');
    const registerForm = document.querySelector('.register-form');
    
    if (formType === 'register') {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    } else {
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
    }
}

// Login form submission

document.querySelector('.login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-username').value; // Get value from username field
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch('http://localhost:3000/api/farmer/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }), // Change username to email
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('farmerToken', data.token);
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = data.message || 'Login failed';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    }
});

// Registration form submission
document.querySelector('.register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullname = document.getElementById('reg-fullname').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const errorDiv = document.getElementById('register-error');

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/farmer/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fullname,
                email,
                phone,
                password
            }),
        });

        const data = await response.json();

        if (response.ok) {
            alert('Registration successful! Please login.');
            toggleForm('login');
        } else {
            errorDiv.textContent = data.message || 'Registration failed';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
    }
});