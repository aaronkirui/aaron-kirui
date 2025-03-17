const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { 
    getFarmer, 
    registerFarmer, 
    saveMilkSubmission,
    getFarmerSubmissions,
    updateMilkPrice,
    getCurrentPrice,
    getFarmerPayments,
    saveFeedback,
    getFarmerFeedback,
    getFarmerStats,
    db
} = require('./db');

const app = express();
const JWT_SECRET = 'fc95c2da1a6d2020981939743cecf25bbb3d5b07174f8c5ac24cdb00f82871691e38092084627a6fa89fa5276883015dbc118e8fb442e6cce054412b02b28b7b'; 

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateFarmer = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.farmerId = decoded.farmerId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed' });
    }
};



// Farmer Routes
app.post('/api/farmer/register', async (req, res) => {
    try {
        const { fullname, email, phone, password } = req.body;
        
        // Check if farmer exists
        const existingFarmer = await getFarmer({ email });
        if (existingFarmer) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Register farmer
        const farmerId = await registerFarmer({
            fullname,
            email,
            phone,
            password: hashedPassword
        });

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Registration failed' });
    }
});

app.post('/api/farmer/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Get farmer
        const farmer = await getFarmer({ email });
        if (!farmer) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, farmer.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ farmerId: farmer.id }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ token, farmerId: farmer.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Login failed' });
    }
});

app.get('/api/farmer/profile', authenticateFarmer, async (req, res) => {
    try {
        const farmer = await getFarmer({ id: req.farmerId });
        if (!farmer) {
            return res.status(404).json({ message: 'Farmer not found' });
        }

        // Remove sensitive data
        delete farmer.password;
        res.json(farmer);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
});

app.get('/api/farmer/stats', authenticateFarmer, async (req, res) => {
    try {
        const stats = await getFarmerStats(req.farmerId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
});

app.get('/api/farmer/submissions', authenticateFarmer, async (req, res) => {
    try {
        const { period = 'daily' } = req.query;
        const submissions = await getFarmerSubmissions(req.farmerId, period);
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch submissions' });
    }
});

app.get('/api/farmer/payments', authenticateFarmer, async (req, res) => {
    try {
        const payments = await getFarmerPayments(req.farmerId);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch payments' });
    }
});

app.post('/api/farmer/feedback', authenticateFarmer, async (req, res) => {
    try {
        const { subject, message } = req.body;
        await saveFeedback(req.farmerId, subject, message);
        res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to submit feedback' });
    }
});

app.get('/api/farmer/feedback', authenticateFarmer, async (req, res) => {
    try {
        const feedback = await getFarmerFeedback(req.farmerId);
        res.json(feedback);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch feedback' });
    }
});






// Admin Routes
app.post("/api/admin/milk-submission", async (req, res) => {
    try {
      const { farmerId, morning, evening, date } = req.body
  
      // Save milk submission
      await saveMilkSubmission(farmerId, morning, evening, date)
  
      // Get the month for this submission
      const submissionMonth = new Date(date).toISOString().slice(0, 7) // Format: YYYY-MM
  
      // Calculate total liters for the month
      const totalLiters = await new Promise((resolve, reject) => {
        db.get(
          `SELECT SUM(morning_amount + evening_amount) as total
                   FROM milk_submissions
                   WHERE farmer_id = ? AND strftime('%Y-%m', date) = ?`,
          [farmerId, submissionMonth],
          (err, row) => {
            if (err) reject(err)
            resolve(row ? row.total : 0)
          },
        )
      })
  
      // Get current milk price
      const currentPrice = await getCurrentPrice()
  
      // Calculate total amount
      const totalAmount = totalLiters * currentPrice
  
      // Check if a payment record already exists for this farmer and month
      const existingPayment = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM payments WHERE farmer_id = ? AND month = ?", [farmerId, submissionMonth], (err, row) => {
          if (err) reject(err)
          resolve(row)
        })
      })
  
      if (existingPayment) {
        // Update existing payment record
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE payments 
                       SET total_liters = ?, 
                           total_amount = ?,
                           rate = ?
                       WHERE id = ?`,
            [totalLiters, totalAmount, currentPrice, existingPayment.id],
            (err) => {
              if (err) reject(err)
              resolve()
            },
          )
        })
      } else {
        // Create new payment record
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO payments 
                       (farmer_id, month, total_liters, rate, total_amount, status) 
                       VALUES (?, ?, ?, ?, ?, ?)`,
            [farmerId, submissionMonth, totalLiters, currentPrice, totalAmount, "Pending"],
            (err) => {
              if (err) reject(err)
              resolve()
            },
          )
        })
      }
  
      res.json({ message: "Milk submission recorded and payment updated successfully" })
    } catch (error) {
      console.error("Error in milk submission:", error)
      res.status(500).json({ message: "Failed to record submission and update payment", error: error.message })
    }
  })
  
  
  

// Get price history
app.get("/api/admin/prices/history",  async (req, res) => {
    try {
      const { period } = req.query
      let timeFilter = ""
  
      switch (period) {
        case "6months":
          timeFilter = "WHERE effective_date >= date('now', '-6 months')"
          break
        case "1year":
          timeFilter = "WHERE effective_date >= date('now', '-1 year')"
          break
        default:
          timeFilter = ""
      }
  
      const priceHistory = await new Promise((resolve, reject) => {
        db.all(
          `
                  SELECT 
                      id,
                      price,
                      effective_date,
                      notes,
                      (price - LAG(price) OVER (ORDER BY effective_date)) as change
                  FROM milk_prices
                  ${timeFilter}
                  ORDER BY effective_date DESC
              `,
          (err, rows) => {
            if (err) reject(err)
            resolve(rows || [])
          },
        )
      })
  
      res.json(priceHistory)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to fetch price history" })
    }
  })
  
  // Update milk price
  app.post("/api/admin/price",  async (req, res) => {
    try {
      const { price, effectiveDate, notes } = req.body
  
      await new Promise((resolve, reject) => {
        db.run(
          `
                  INSERT INTO milk_prices (price, effective_date, notes)
                  VALUES (?, ?, ?)
              `,
          [price, effectiveDate, notes],
          (err) => {
            if (err) reject(err)
            resolve()
          },
        )
      })
  
      res.json({ message: "Price updated successfully" })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to update price" })
    }
  })
  
  // Get current price
  app.get("/api/prices/current", async (req, res) => {
    try {
      const currentPrice = await new Promise((resolve, reject) => {
        db.get(
          `
                  SELECT price, effective_date
                  FROM milk_prices
                  ORDER BY effective_date DESC
                  LIMIT 1
              `,
          (err, row) => {
            if (err) reject(err)
            resolve(row)
          },
        )
      })
  
      res.json(currentPrice)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to fetch current price" })
    }
  })




// Get total farmers count
app.get('/api/admin/farmers/count',  async (req, res) => {
    try {
        const count = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM farmers', (err, row) => {
                if (err) reject(err);
                resolve(row ? row.count : 0);
            });
        });
        
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch farmers count' });
    }
});

// Get today's milk collection
app.get('/api/admin/milk-submissions/today',  async (req, res) => {
    try {
        const result = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COALESCE(SUM(morning_amount), 0) + COALESCE(SUM(evening_amount), 0) as total
                FROM milk_submissions
                WHERE date = date('now')
            `, (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        
        res.json({ total: result.total });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch today\'s collection' });
    }
});

// Get milk submission stats by period
app.get('/api/admin/milk-submissions/stats',  async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let timeFilter;
        switch(period) {
            case 'week':
                timeFilter = "date >= date('now', '-7 days')";
                break;
            case 'month':
                timeFilter = "date >= date('now', 'start of month')";
                break;
            case 'year':
                timeFilter = "date >= date('now', 'start of year')";
                break;
            default:
                timeFilter = "date >= date('now', '-30 days')";
        }
        
        const data = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    date,
                    SUM(morning_amount) as morning,
                    SUM(evening_amount) as evening
                FROM milk_submissions
                WHERE ${timeFilter}
                GROUP BY date
                ORDER BY date
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch milk submission stats' });
    }
});

// Get top farmers by milk contribution
app.get('/api/admin/farmers/top', async (req, res) => {
    try {
        const farmers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    f.id,
                    f.fullname,
                    COALESCE(SUM(ms.morning_amount + ms.evening_amount), 0) as total
                FROM farmers f
                LEFT JOIN milk_submissions ms ON f.id = ms.farmer_id
                WHERE ms.date >= date('now', '-30 days')
                GROUP BY f.id
                ORDER BY total DESC
                LIMIT 5
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        res.json({ farmers });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch top farmers' });
    }
});

// Get current month's payments
app.get("/api/admin/payments/month", async (req, res) => {
    try {
        const result = await new Promise((resolve, reject) => {
            const currentDate = new Date();
            const currentMonth = currentDate.getFullYear() + '-' + 
                String(currentDate.getMonth() + 1).padStart(2, '0');

            db.get(
                `SELECT COALESCE(SUM(total_amount), 0) as total
                FROM payments
                WHERE strftime('%Y-%m', month) = ?`,
                [currentMonth],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        res.json({ total: result.total });
    } catch (error) {
        console.error("Error fetching monthly payments:", error);
        res.status(500).json({ 
            message: "Failed to fetch monthly payments", 
            error: error.message 
        });
    }
});
  

// Get revenue distribution (simplified for demo)
app.get('/api/admin/revenue/distribution',async (req, res) => {
    try {
        // Get total payments to farmers this month
        const farmerPayments = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM payments
                WHERE strftime('%Y-%m', month) = strftime('%Y-%m', 'now')
            `, (err, row) => {
                if (err) reject(err);
                resolve(row.total);
            });
        });
        
        // Calculate other categories based on typical distribution
        // In a real app, these would come from actual expense tracking
        const totalRevenue = farmerPayments / 0.65; // Assuming farmer payments are 65% of revenue
        
        const distribution = {
            farmerPayments,
            operationalCosts: totalRevenue * 0.15,
            marketing: totalRevenue * 0.05,
            profit: totalRevenue * 0.15
        };
        
        res.json({ distribution });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch revenue distribution' });
    }
});

// Get recent activities
app.get('/api/admin/activities/recent',async (req, res) => {
    try {
        // Combining multiple activity types from different tables
        const recentSubmissions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ms.id,
                    f.fullname,
                    (ms.morning_amount + ms.evening_amount) as amount,
                    ms.created_at,
                    'milk_submission' as type
                FROM milk_submissions ms
                JOIN farmers f ON ms.farmer_id = f.id
                ORDER BY ms.created_at DESC
                LIMIT 3
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        const recentFarmers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    fullname,
                    created_at,
                    'registration' as type
                FROM farmers
                ORDER BY created_at DESC
                LIMIT 2
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        const recentPrices = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    price,
                    created_at,
                    'price_update' as type
                FROM milk_prices
                ORDER BY created_at DESC
                LIMIT 1
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        // Format all activities into a consistent structure
        const activities = [];
        
        recentSubmissions.forEach(sub => {
            activities.push({
                id: `sub_${sub.id}`,
                type: sub.type,
                message: `<strong>${sub.fullname}</strong> submitted ${sub.amount.toFixed(1)}L of milk`,
                createdAt: sub.created_at
            });
        });
        
        recentFarmers.forEach(farmer => {
            activities.push({
                id: `farmer_${farmer.id}`,
                type: farmer.type,
                message: `New farmer <strong>${farmer.fullname}</strong> registered`,
                createdAt: farmer.created_at
            });
        });
        
        recentPrices.forEach(price => {
            activities.push({
                id: `price_${price.id}`,
                type: price.type,
                message: `Milk price updated to <strong>$${price.price.toFixed(2)}</strong>`,
                createdAt: price.created_at
            });
        });
        
        // Sort all activities by created_at
        activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({ activities: activities.slice(0, 5) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch recent activities' });
    }
});




// Get recent milk submissions
app.get('/api/admin/milk-submissions/recent',  async (req, res) => {
    try {
        const recentSubmissions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ms.id,
                    ms.farmer_id,
                    ms.morning_amount,
                    ms.evening_amount,
                    ms.date,
                    ms.created_at
                FROM milk_submissions ms
                ORDER BY ms.created_at DESC
                LIMIT 10
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        res.json(recentSubmissions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch recent submissions' });
    }
});

// Delete a milk submission
app.delete('/api/admin/milk-submission/:id',  async (req, res) => {
    try {
        const { id } = req.params;
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM milk_submissions WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
        
        res.json({ message: 'Milk submission deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete milk submission' });
    }
});

app.get('/api/admin/farmers', async (req, res) => {
    try {
        const farmers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, fullname, email, phone, created_at
                FROM farmers
                ORDER BY created_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        res.json(farmers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch farmers' });
    }
});

// Get a single farmer
app.get('/api/admin/farmer/:id',  async (req, res) => {
    try {
        const { id } = req.params;
        const farmer = await new Promise((resolve, reject) => {
            db.get(`
                SELECT id, fullname, email, phone, created_at
                FROM farmers
                WHERE id = ?
            `, [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        
        if (!farmer) {
            return res.status(404).json({ message: 'Farmer not found' });
        }
        
        res.json(farmer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch farmer details' });
    }
});

// Update a farmer
app.put('/api/admin/farmer/:id',  async (req, res) => {
    try {
        const { id } = req.params;
        const { fullname, email, phone } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE farmers
                SET fullname = ?, email = ?, phone = ?
                WHERE id = ?
            `, [fullname, email, phone, id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
        
        res.json({ message: 'Farmer updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update farmer' });
    }
});

// Delete a farmer
app.delete('/api/admin/farmer/:id',  async (req, res) => {
    try {
        const { id } = req.params;
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM farmers WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
        
        res.json({ message: 'Farmer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete farmer' });
    }
});




// Get all feedbacks
app.get('/api/admin/feedbacks',  async (req, res) => {
    try {
        const feedbacks = await new Promise((resolve, reject) => {
            db.all(`
                SELECT f.id, f.farmer_id, f.subject, f.message, f.response, f.created_at, fr.fullname as farmer_name
                FROM feedback f
                JOIN farmers fr ON f.farmer_id = fr.id
                ORDER BY f.created_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        res.json(feedbacks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch feedbacks' });
    }
});

// Respond to a feedback
app.post('/api/admin/feedback/:id/respond', async (req, res) => {
    try {
        const { id } = req.params;
        const { response } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE feedback
                SET response = ?
                WHERE id = ?
            `, [response, id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
        
        res.json({ message: 'Response submitted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to submit response' });
    }
});


app.get("/api/admin/db-info",  async (req, res) => {
    try {
      const paymentsStructure = await checkTableStructure("payments")
      const farmersStructure = await checkTableStructure("farmers")
      res.json({ payments: paymentsStructure, farmers: farmersStructure })
    } catch (error) {
      console.error("Error fetching database info:", error)
      res.status(500).json({ message: "Failed to fetch database info", error: error.message })
    }
  })
  

// Get payments
app.get("/api/admin/payments", async (req, res) => {
    try {
      const { page = 1, search = "" } = req.query;
      const itemsPerPage = 10;
      const offset = (page - 1) * itemsPerPage;
  
     
      const query = `
        SELECT 
          p.id,
          p.farmer_id,
          p.month,
          p.total_liters,
          p.rate,
          p.total_amount,
          p.status,
          p.created_at,
          f.fullname as farmer_name
        FROM payments p
        LEFT JOIN farmers f ON p.farmer_id = f.id
        WHERE COALESCE(f.fullname, p.farmer_id) LIKE ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;
  
      const countQuery = `
        SELECT COUNT(*) as total
        FROM payments p
        LEFT JOIN farmers f ON p.farmer_id = f.id
        WHERE COALESCE(f.fullname, p.farmer_id) LIKE ?
      `;
  
      const [payments, totalResult] = await Promise.all([
        new Promise((resolve, reject) => {
          db.all(query, [`%${search}%`, itemsPerPage, offset], (err, rows) => {
            if (err) reject(err);
            resolve(rows || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.get(countQuery, [`%${search}%`], (err, row) => {
            if (err) reject(err);
            resolve(row || { total: 0 });
          });
        }),
      ]);
  
      res.json({
        payments,
        total: totalResult.total,
      });
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments", error: error.message });
    }
  });

  // Update payment status
  app.put("/api/admin/payments/:id", async (req, res) => {
    try {
      const { id } = req.params
      const { status } = req.body
  
      await new Promise((resolve, reject) => {
        db.run("UPDATE payments SET status = ? WHERE id = ?", [status, id], function (err) {
          if (err) reject(err)
          resolve(this.changes)
        })
      })
  
      res.json({ message: "Payment status updated successfully" })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to update payment status" })
    }
  })
  
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});