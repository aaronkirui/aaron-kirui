const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const db = new sqlite3.Database(path.join(__dirname, 'dairy.sqlite'), (err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Farmers table
        db.run(`
            CREATE TABLE IF NOT EXISTS farmers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fullname TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Milk submissions table
        db.run(`
            CREATE TABLE IF NOT EXISTS milk_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farmer_id INTEGER NOT NULL,
                morning_amount REAL,
                evening_amount REAL,
                date DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (farmer_id) REFERENCES farmers (id)
            )
        `);

        // Milk prices table
        db.run(`
            CREATE TABLE IF NOT EXISTS milk_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                price REAL NOT NULL,
                effective_date DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        `);

        // Payments table
        db.run(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farmer_id INTEGER NOT NULL,
                month DATE NOT NULL,
                total_liters REAL NOT NULL,
                rate REAL NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (farmer_id) REFERENCES farmers (id)
            )
        `);

        // Feedback table
        db.run(`
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farmer_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                response TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (farmer_id) REFERENCES farmers (id)
            )
        `);
    });
}

// Farmer-related functions
async function getFarmer(params) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM farmers WHERE ';
        const conditions = [];
        const values = [];

        if (params.id) {
            conditions.push('id = ?');
            values.push(params.id);
        }
        if (params.email) {
            conditions.push('email = ?');
            values.push(params.email);
        }

        query += conditions.join(' AND ');

        db.get(query, values, (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

async function registerFarmer(farmerData) {
    return new Promise((resolve, reject) => {
        const { fullname, email, phone, password } = farmerData;
        db.run(
            'INSERT INTO farmers (fullname, email, phone, password) VALUES (?, ?, ?, ?)',
            [fullname, email, phone, password],
            function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            }
        );
    });
}

// Milk submission functions
async function saveMilkSubmission(farmerId, morning, evening, date) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO milk_submissions (farmer_id, morning_amount, evening_amount, date) VALUES (?, ?, ?, ?)',
            [farmerId, morning, evening, date],
            (err) => {
                if (err) reject(err);
                resolve();
            }
        );
    });
}

async function getFarmerSubmissions(farmerId, period) {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT 
                date,
                morning_amount as morning,
                evening_amount as evening,
                (morning_amount + evening_amount) * (
                    SELECT price 
                    FROM milk_prices 
                    WHERE effective_date <= milk_submissions.date 
                    ORDER BY effective_date DESC 
                    LIMIT 1
                ) as amount
            FROM milk_submissions
            WHERE farmer_id = ?
        `;

        switch (period) {
            case 'weekly':
                query += ' AND date >= date("now", "-7 days")';
                break;
            case 'monthly':
                query += ' AND date >= date("now", "start of month")';
                break;
            case 'yearly':
                query += ' AND date >= date("now", "start of year")';
                break;
            default: // daily
                query += ' AND date >= date("now", "-30 days")';
        }

        query += ' ORDER BY date DESC';

        db.all(query, [farmerId], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

// Price management functions
async function updateMilkPrice(price) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO milk_prices (price, effective_date) VALUES (?, date("now"))',
            [price],
            (err) => {
                if (err) reject(err);
                resolve();
            }
        );
    });
}

async function getCurrentPrice() {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT price FROM milk_prices ORDER BY effective_date DESC LIMIT 1',
            (err, row) => {
                if (err) reject(err);
                resolve(row ? row.price : 0);
            }
        );
    });
}

// Payment functions
async function getFarmerPayments(farmerId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM payments WHERE farmer_id = ? ORDER BY month DESC`,
            [farmerId],
            (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            }
        );
    });
}

// Feedback functions
async function saveFeedback(farmerId, subject, message) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO feedback (farmer_id, subject, message) VALUES (?, ?, ?)',
            [farmerId, subject, message],
            (err) => {
                if (err) reject(err);
                resolve();
            }
        );
    });
}

async function getFarmerFeedback(farmerId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM feedback WHERE farmer_id = ? ORDER BY created_at DESC`,
            [farmerId],
            (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            }
        );
    });
}

// Statistics functions
async function getFarmerStats(farmerId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                (SELECT COALESCE(SUM(morning_amount + evening_amount), 0)
                 FROM milk_submissions 
                 WHERE farmer_id = ? AND date = date('now')) as todayTotal,
                
                (SELECT COALESCE(SUM(morning_amount + evening_amount), 0)
                 FROM milk_submissions 
                 WHERE farmer_id = ? AND date >= date('now', 'start of month')) as monthTotal,
                
                (SELECT COALESCE(SUM(morning_amount + evening_amount) * 
                    (SELECT price FROM milk_prices 
                     WHERE effective_date <= milk_submissions.date 
                     ORDER BY effective_date DESC LIMIT 1), 0)
                 FROM milk_submissions 
                 WHERE farmer_id = ? AND date >= date('now', 'start of month')) as expectedPayment
        `, [farmerId, farmerId, farmerId], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

module.exports = {
    db,
    getFarmer,
    registerFarmer,
    saveMilkSubmission,
    getFarmerSubmissions,
    updateMilkPrice,
    getCurrentPrice,
    getFarmerPayments,
    saveFeedback,
    getFarmerFeedback,
    getFarmerStats
};