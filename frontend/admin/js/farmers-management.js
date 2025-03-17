document.addEventListener('DOMContentLoaded', function() {
    const farmersTable = document.getElementById('farmersTable').getElementsByTagName('tbody')[0];
    const editFarmerModal = document.getElementById('editFarmerModal');
    const editFarmerForm = document.getElementById('editFarmerForm');
    const closeModal = document.getElementsByClassName('close')[0];

    // Function to add a new row to the farmers table
    function addFarmerRow(farmer) {
        const row = farmersTable.insertRow();
        row.innerHTML = `
            <td>${farmer.id}</td>
            <td>${farmer.fullname}</td>
            <td>${farmer.email}</td>
            <td>${farmer.phone}</td>
            <td>${new Date(farmer.created_at).toLocaleDateString()}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${farmer.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${farmer.id}">Delete</button>
            </td>
        `;
    }

    // Function to fetch and display farmers
    async function fetchFarmers() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/farmers');
            if (!response.ok) {
                throw new Error('Failed to fetch farmers');
            }
            const farmers = await response.json();
            farmersTable.innerHTML = ''; // Clear existing rows
            farmers.forEach(addFarmerRow);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to fetch farmers. Please try again.');
        }
    }

    // Handle edit and delete actions
    farmersTable.addEventListener('click', async function(e) {
        if (e.target.classList.contains('edit-btn')) {
            const id = e.target.getAttribute('data-id');
            openEditModal(id);
        } else if (e.target.classList.contains('delete-btn')) {
            const id = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this farmer?')) {
                try {
                    const response = await fetch(`http://localhost:3000/api/admin/farmer/${id}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete farmer');
                    }

                    alert('Farmer deleted successfully');
                    fetchFarmers(); // Refresh the table
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to delete farmer. Please try again.');
                }
            }
        }
    });

    // Function to open edit modal and populate form
    async function openEditModal(id) {
        try {
            const response = await fetch(`http://localhost:3000/api/admin/farmer/${id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch farmer details');
            }
            const farmer = await response.json();
            
            document.getElementById('editFarmerId').value = farmer.id;
            document.getElementById('editFullname').value = farmer.fullname;
            document.getElementById('editEmail').value = farmer.email;
            document.getElementById('editPhone').value = farmer.phone;
            
            editFarmerModal.style.display = 'block';
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to fetch farmer details. Please try again.');
        }
    }

    // Handle form submission for editing farmer
    editFarmerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(editFarmerForm);
        const data = Object.fromEntries(formData.entries());
        const farmerId = document.getElementById('editFarmerId').value;
        
        try {
            const response = await fetch(`http://localhost:3000/api/admin/farmer/${farmerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Failed to update farmer');
            }

            alert('Farmer updated successfully');
            editFarmerModal.style.display = 'none';
            fetchFarmers(); // Refresh the table
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to update farmer. Please try again.');
        }
    });

    // Close modal when clicking on <span> (x)
    closeModal.onclick = function() {
        editFarmerModal.style.display = 'none';
    }

    // Close modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target == editFarmerModal) {
            editFarmerModal.style.display = 'none';
        }
    }

    // Fetch initial data
    fetchFarmers();
});