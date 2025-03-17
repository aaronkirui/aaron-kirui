document.addEventListener("DOMContentLoaded", () => {
    // Check if admin is authenticated
    if (localStorage.getItem('adminAuthenticated') !== 'true') {
        window.location.href = 'index.html';
        return;
    }
  
    // Handle sidebar toggle
    const toggleBtn = document.querySelector(".toggle-sidebar")
    const sidebar = document.querySelector(".sidebar")
  
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  
    // Handle logout
    const logoutBtn = document.getElementById("logoutBtn")
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault()
      localStorage.removeItem("adminToken")
      window.location.href = "index.html"
    })
  
    // Pagination variables
    let currentPage = 1
    const itemsPerPage = 10
    let totalItems = 0
  
    // Fetch and display payments
    async function fetchPayments(page = 1, search = "") {
      try {
        const response = await fetch(`http://localhost:3000/api/admin/payments?page=${page}&search=${search}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
        })
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
  
        const data = await response.json()
  
        if (!data || !Array.isArray(data.payments)) {
          throw new Error("Invalid data structure received from server")
        }
  
        totalItems = data.total || 0
        displayPayments(data.payments)
        updatePagination()
      } catch (error) {
        console.error("Failed to fetch payments:", error)
        displayError("Failed to load payments data. Please try again later.")
      }
    }
  
    function displayPayments(payments) {
      const tableBody = document.getElementById("paymentsTableBody")
      tableBody.innerHTML = ""
  
      if (payments.length === 0) {
        const row = document.createElement("tr")
        row.innerHTML = '<td colspan="8" class="text-center">No payments found</td>'
        tableBody.appendChild(row)
        return
      }
  
      payments.forEach((payment) => {
        const row = document.createElement("tr")
        row.innerHTML = `
        <td>${payment.id}</td>
        <td>${payment.farmer_name || `Farmer #${payment.farmer_id}`}</td>
        <td>${payment.total_liters.toFixed(2)} L</td>
        <td>KES ${payment.rate.toFixed(2)}</td>
        <td>KES ${payment.total_amount.toFixed(2)}</td>
        <td>${new Date(payment.month).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</td>
        <td>
          <span class="status-badge status-${payment.status.toLowerCase()}">
            ${payment.status}
          </span>
        </td>
        <td>
          ${payment.status === "Pending" ? `<button class="btn-paid" data-id="${payment.id}">Mark as Paid</button>` : "-"}
        </td>
      `
        tableBody.appendChild(row)
      })
  
      // Add event listeners to "Mark as Paid" buttons
      document.querySelectorAll(".btn-paid").forEach((button) => {
        button.addEventListener("click", handlePaymentStatusUpdate)
      })
    }
  
    function displayError(message) {
      const tableBody = document.getElementById("paymentsTableBody")
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">${message}</td></tr>`
    }
  
    async function handlePaymentStatusUpdate(event) {
      const paymentId = event.target.getAttribute("data-id")
      try {
        const response = await fetch(`http://localhost:3000/api/admin/payments/${paymentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
          body: JSON.stringify({ status: "Paid" }),
        })
  
        if (!response.ok) throw new Error("Failed to update payment status")
  
        alert("Payment status updated successfully")
        fetchPayments(currentPage)
      } catch (error) {
        console.error("Failed to update payment status:", error)
        alert("Failed to update payment status. Please try again.")
      }
    }
  
    function updatePagination() {
      const totalPages = Math.ceil(totalItems / itemsPerPage)
      document.getElementById("currentPage").textContent = currentPage
      document.getElementById("prevPage").disabled = currentPage === 1
      document.getElementById("nextPage").disabled = currentPage === totalPages
      document.getElementById("startEntry").textContent = (currentPage - 1) * itemsPerPage + 1
      document.getElementById("endEntry").textContent = Math.min(currentPage * itemsPerPage, totalItems)
      document.getElementById("totalEntries").textContent = totalItems
    }
  
    // Pagination event listeners
    document.getElementById("prevPage").addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--
        fetchPayments(currentPage)
      }
    })
  
    document.getElementById("nextPage").addEventListener("click", () => {
      const totalPages = Math.ceil(totalItems / itemsPerPage)
      if (currentPage < totalPages) {
        currentPage++
        fetchPayments(currentPage)
      }
    })
  
    // Search functionality
    const searchInput = document.getElementById("paymentSearch")
    let searchTimeout
  
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        currentPage = 1
        fetchPayments(currentPage, searchInput.value)
      }, 300)
    })
  
    // Initial fetch
    fetchPayments()
  })
  
  