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
      window.location.href = 'index.html';
  });
  
  // Initialize price history chart
  let priceHistoryChart;
  
  function initializePriceHistoryChart() {
      const ctx = document.getElementById('priceHistoryChart').getContext('2d');
      priceHistoryChart = new Chart(ctx, {
          type: 'line',
          data: {
              labels: [],
              datasets: [{
                  label: 'Price per Liter (KES)',
                  data: [],
                  borderColor: '#2563eb',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  borderWidth: 2,
                  fill: true,
                  tension: 0.4
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: {
                      display: false
                  },
                  tooltip: {
                      mode: 'index',
                      intersect: false,
                      callbacks: {
                          label: function(context) {
                              return `KES ${context.raw.toFixed(2)}`;
                          }
                      }
                  }
              },
              scales: {
                  y: {
                      beginAtZero: true,
                      ticks: {
                          callback: function(value) {
                              return 'KES ' + value.toFixed(2);
                          }
                      }
                  }
              }
          }
      });
  }
  
  // Populate price history table
  async function populatePriceHistoryTable() {
      try {
          // Changed from /api/prices/history to /api/admin/prices/history to match server route
          const response = await fetch('http://localhost:3000/api/admin/prices/history');
          const data = await response.json();
          
          const tableBody = document.getElementById('priceHistoryTableBody');
          tableBody.innerHTML = '';
          
          if (!data || data.length === 0) {
              // Display a message if no price history is available
              const row = document.createElement('tr');
              row.innerHTML = '<td colspan="5" class="text-center">No price history available</td>';
              tableBody.appendChild(row);
              return;
          }
          
          data.forEach(record => {
              const row = document.createElement('tr');
              
              // Safely handle the change value which might be null for the first entry
              let changeHtml = '-';
              if (record.change !== null && record.change !== undefined) {
                  const changeValue = parseFloat(record.change);
                  if (!isNaN(changeValue)) {
                      changeHtml = changeValue > 0 ? 
                          `<span class="price-increase">+${changeValue.toFixed(2)}</span>` : 
                          `<span class="price-decrease">${changeValue.toFixed(2)}</span>`;
                  }
              }
              
              row.innerHTML = `
                  <td>${record.effective_date ? new Date(record.effective_date).toLocaleDateString() : '-'}</td>
                  <td>KES ${record.price !== null ? parseFloat(record.price).toFixed(2) : '-'}</td>
                  <td>${changeHtml}</td>
                  <td>Admin</td>
                  <td>${record.notes || '-'}</td>
              `;
              tableBody.appendChild(row);
          });
          
          // Update chart data
          updateChartData(data);
      } catch (error) {
          console.error('Failed to fetch price history:', error);
          // Display error message in the table
          const tableBody = document.getElementById('priceHistoryTableBody');
          tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load price history data. Please try again.</td></tr>';
      }
  }
  
  function updateChartData(data) {
      if (!data || data.length === 0) {
          // Clear chart if no data
          priceHistoryChart.data.labels = [];
          priceHistoryChart.data.datasets[0].data = [];
          priceHistoryChart.update();
          return;
      }
      
      const labels = [];
      const prices = [];
      
      // Safely extract data for the chart
      data.forEach(record => {
          if (record.effective_date) {
              labels.push(new Date(record.effective_date).toLocaleDateString());
          }
          
          if (record.price !== null && record.price !== undefined) {
              prices.push(parseFloat(record.price));
          }
      });
      
      priceHistoryChart.data.labels = labels;
      priceHistoryChart.data.datasets[0].data = prices;
      priceHistoryChart.update();
  }
  
  // Handle price update form visibility
  const updatePriceBtn = document.getElementById('updatePriceBtn');
  const priceUpdateForm = document.getElementById('priceUpdateForm');
  const closeFormBtn = document.getElementById('closeFormBtn');
  const cancelPriceUpdate = document.getElementById('cancelPriceUpdate');
  
  updatePriceBtn.addEventListener('click', function() {
      priceUpdateForm.style.display = 'block';
      const currentPrice = document.getElementById('currentPriceValue').textContent;
      // Only set the value if it's not empty
      document.getElementById('newPrice').value = currentPrice || '';
      document.getElementById('effectiveDate').valueAsDate = new Date();
  });
  
  function hideUpdateForm() {
      priceUpdateForm.style.display = 'none';
      document.getElementById('updatePriceForm').reset();
  }
  
  closeFormBtn.addEventListener('click', hideUpdateForm);
  cancelPriceUpdate.addEventListener('click', hideUpdateForm);
  
  // Get current price on page load
  async function getCurrentPrice() {
      try {
          const response = await fetch('http://localhost:3000/api/prices/current');
          const data = await response.json();
          
          if (data && data.price !== null && data.price !== undefined) {
              document.getElementById('currentPriceValue').textContent = parseFloat(data.price).toFixed(2);
              
              if (data.effective_date) {
                  document.getElementById('lastUpdateDate').textContent = new Date(data.effective_date).toLocaleDateString();
              } else {
                  document.getElementById('lastUpdateDate').textContent = 'N/A';
              }
          } else {
              document.getElementById('currentPriceValue').textContent = 'Not set';
              document.getElementById('lastUpdateDate').textContent = 'N/A';
          }
      } catch (error) {
          console.error('Failed to fetch current price:', error);
          document.getElementById('currentPriceValue').textContent = 'Error';
          document.getElementById('lastUpdateDate').textContent = 'N/A';
      }
  }
  
  // Handle price update submission
  document.getElementById('updatePriceForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const newPriceInput = document.getElementById('newPrice').value;
      if (!newPriceInput) {
          alert('Please enter a valid price');
          return;
      }
      
      const newPrice = parseFloat(newPriceInput);
      if (isNaN(newPrice) || newPrice <= 0) {
          alert('Please enter a valid positive price');
          return;
      }
      
      const effectiveDate = document.getElementById('effectiveDate').value;
      const notes = document.getElementById('priceNotes').value;
      
      try {
          const response = await fetch('http://localhost:3000/api/admin/price', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  price: newPrice,
                  effectiveDate,
                  notes
              })
          });
          
          if (!response.ok) throw new Error('Failed to update price');
          
          // Update current price display
          document.getElementById('currentPriceValue').textContent = newPrice.toFixed(2);
          document.getElementById('lastUpdateDate').textContent = new Date().toLocaleDateString();
          
          // Refresh price history
          await populatePriceHistoryTable();
          hideUpdateForm();
          
          alert('Price updated successfully');
      } catch (error) {
          console.error('Failed to update price:', error);
          alert('Failed to update price. Please try again.');
      }
  });
  
  // Handle price history period change
  document.getElementById('priceHistoryPeriod').addEventListener('change', async function(e) {
      try {
          const period = e.target.value;
          // Changed from /api/prices/history to /api/admin/prices/history to match server route
          const response = await fetch(`http://localhost:3000/api/admin/prices/history?period=${period}`);
          const data = await response.json();
          updateChartData(data);
      } catch (error) {
          console.error('Failed to update price history:', error);
          alert('Failed to load price history data');
      }
  });
  
  // Initialize the page
  initializePriceHistoryChart();
  getCurrentPrice(); // Get current price first
  populatePriceHistoryTable();
});