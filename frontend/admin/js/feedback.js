document.addEventListener('DOMContentLoaded', function() {
    const feedbackList = document.getElementById('feedbackList');
    const responseModal = document.getElementById('responseModal');
    const responseForm = document.getElementById('responseForm');
    const closeModal = document.getElementsByClassName('close')[0];

    // Function to create a feedback item
    function createFeedbackItem(feedback) {
        const feedbackItem = document.createElement('div');
        feedbackItem.className = 'feedback-item';
        feedbackItem.innerHTML = `
            <div class="feedback-header">
                <span class="farmer-info">${feedback.farmer_name}</span>
                <span class="feedback-date">${new Date(feedback.created_at).toLocaleString()}</span>
            </div>
            <div class="feedback-subject">${feedback.subject}</div>
            <div class="feedback-message">${feedback.message}</div>
            ${feedback.response ? `
                <div class="feedback-response">
                    <h4>Admin Response:</h4>
                    <p>${feedback.response}</p>
                </div>
            ` : `
                <div class="feedback-actions">
                    <button class="btn-respond" data-id="${feedback.id}">Respond</button>
                </div>
            `}
        `;
        return feedbackItem;
    }

    // Function to fetch and display feedbacks
    async function fetchFeedbacks() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/feedbacks');
            if (!response.ok) {
                throw new Error('Failed to fetch feedbacks');
            }
            const feedbacks = await response.json();
            feedbackList.innerHTML = ''; // Clear existing feedbacks
            feedbacks.forEach(feedback => {
                feedbackList.appendChild(createFeedbackItem(feedback));
            });
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to fetch feedbacks. Please try again.');
        }
    }

    // Handle respond button click
    feedbackList.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-respond')) {
            const feedbackId = e.target.getAttribute('data-id');
            openResponseModal(feedbackId);
        }
    });

    // Function to open response modal
    function openResponseModal(feedbackId) {
        document.getElementById('feedbackId').value = feedbackId;
        responseModal.style.display = 'block';
    }

    // Handle form submission for responding to feedback
    responseForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const feedbackId = document.getElementById('feedbackId').value;
        const response = document.getElementById('responseText').value;
        
        try {
            const res = await fetch(`http://localhost:3000/api/admin/feedback/${feedbackId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ response }),
            });

            if (!res.ok) {
                throw new Error('Failed to submit response');
            }

            alert('Response submitted successfully');
            responseModal.style.display = 'none';
            responseForm.reset();
            fetchFeedbacks(); // Refresh the feedback list
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to submit response. Please try again.');
        }
    });

    // Close modal when clicking on <span> (x)
    closeModal.onclick = function() {
        responseModal.style.display = 'none';
    }

    // Close modal when clicking outside of it
    window.onclick = function(event) {
        if (event.target == responseModal) {
            responseModal.style.display = 'none';
        }
    }

    // Fetch initial data
    fetchFeedbacks();
});