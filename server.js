const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database configuration
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission
app.post('/insert_user', (req, res) => {
    const { user_name, age, gender, phone_number, email_id } = req.body;

    const sql = 'INSERT INTO user (user_name, age, gender, phone_number, email_id) VALUES (?, ?, ?, ?, ?)';
    const values = [user_name, age, gender, phone_number, email_id];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            res.status(500).json({ success: false, message: err.message });
            return;
        }
        res.json({ success: true, message: 'User registered successfully' });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 