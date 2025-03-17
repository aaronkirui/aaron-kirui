document.addEventListener('DOMContentLoaded', function() {
    const milkCollectionForm = document.getElementById('milkCollectionForm');
    const recentCollectionsTable = document.getElementById('recentCollectionsTable').getElementsByTagName('tbody')[0];
    const farmerIdInput = document.getElementById('farmerId');
    const autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.className = 'autocomplete-dropdown';
    farmerIdInput.parentNode.appendChild(autocompleteDropdown);
    
    let farmers = []; // Will store all farmers data
    
    // Fetch farmers data
    async function fetchFarmers() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/farmers');
            if (!response.ok) throw new Error('Failed to fetch farmers');
            farmers = await response.json();
        } catch (error) {
            console.error('Error fetching farmers:', error);
        }
    }
    
    // Initialize by fetching farmers
    fetchFarmers();
    
    // Show dropdown when clicking on input
    farmerIdInput.addEventListener('click', function() {
        showDropdown();
    });
    
    // Filter farmers as user types
    farmerIdInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredFarmers = farmers.filter(farmer => 
            farmer.id.toString().includes(searchTerm) ||
            farmer.fullname.toLowerCase().includes(searchTerm)
        );
        updateDropdown(filteredFarmers);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!farmerIdInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
            autocompleteDropdown.style.display = 'none';
        }
    });
    
    function showDropdown() {
        updateDropdown(farmers);
        autocompleteDropdown.style.display = 'block';
    }
    
    function updateDropdown(filteredFarmers) {
        autocompleteDropdown.innerHTML = '';
        
        if (filteredFarmers.length === 0) {
            autocompleteDropdown.innerHTML = '<div class="no-results">No farmers found</div>';
            return;
        }
        
        filteredFarmers.forEach(farmer => {
            const farmerElement = document.createElement('div');
            farmerElement.className = 'farmer-item';
            farmerElement.innerHTML = `
                <span class="farmer-name">${farmer.fullname}</span>
                <span class="farmer-id">ID: ${farmer.id}</span>
            `;
            
            farmerElement.addEventListener('click', function() {
                farmerIdInput.value = farmer.id;
                autocompleteDropdown.style.display = 'none';
            });
            
            autocompleteDropdown.appendChild(farmerElement);
        });
        
        autocompleteDropdown.style.display = 'block';
    }

    // Function to add a new row to the recent collections table
    function addCollectionRow(data) {
        const row = recentCollectionsTable.insertRow();
        row.innerHTML = `
            <td>${data.farmer_id}</td>
            <td>${data.morning_amount}</td>
            <td>${data.evening_amount}</td>
            <td>${(parseFloat(data.morning_amount) + parseFloat(data.evening_amount)).toFixed(1)}</td>
            <td>${data.date}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${data.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${data.id}">Delete</button>
            </td>
        `;
    }

    // Function to fetch and display recent collections
    async function fetchRecentCollections() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/milk-submissions/recent');
            if (!response.ok) {
                throw new Error('Failed to fetch recent collections');
            }
            const collections = await response.json();
            recentCollectionsTable.innerHTML = ''; // Clear existing rows
            collections.forEach(addCollectionRow);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to fetch recent collections. Please try again.');
        }
    }

    // Handle form submission
    milkCollectionForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(milkCollectionForm);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('http://localhost:3000/api/admin/milk-submission', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    farmerId: data.farmerId,
                    morning: parseFloat(data.morningAmount),
                    evening: parseFloat(data.eveningAmount),
                    date: data.collectionDate
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit milk collection');
            }

            alert('Milk collection recorded successfully');
            milkCollectionForm.reset();
            fetchRecentCollections(); // Refresh the table
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to submit milk collection. Please try again.');
        }
    });

    // Handle edit and delete actions
    recentCollectionsTable.addEventListener('click', async function(e) {
        if (e.target.classList.contains('edit-btn')) {
            const id = e.target.getAttribute('data-id');
            // Implement edit functionality
            // This could open a modal with a form pre-filled with the collection data
            console.log('Edit collection:', id);
        } else if (e.target.classList.contains('delete-btn')) {
            const id = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this collection?')) {
                try {
                    const response = await fetch(`http://localhost:3000/api/admin/milk-submission/${id}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete milk collection');
                    }

                    alert('Milk collection deleted successfully');
                    fetchRecentCollections(); // Refresh the table
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to delete milk collection. Please try again.');
                }
            }
        }
    });

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('collectionDate').value = today;

    // Fetch initial data
    fetchRecentCollections();
});