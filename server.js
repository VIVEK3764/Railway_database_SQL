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

// Serve the registration page
app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Search trains endpoint
app.post('/search-trains', (req, res) => {
    const { sourceStation, destinationStation, travelDate } = req.body;

    // Call the stored procedure
    const query = 'CALL search_train_by_station2(?, ?, ?)';

    db.query(query, [sourceStation, destinationStation, travelDate], (err, results) => {
        if (err) {
            console.error('Error executing stored procedure:', err);
            return res.status(500).json({ error: 'Error searching for trains' });
        }

        // The stored procedure returns results in the first element of the results array
        const trains = results[0];
        res.json(trains);
    });
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

// Book ticket endpoint
app.post('/book-ticket', (req, res) => {
    const {
        train_number,
        train_name,
        source_station,
        source_name,
        destination_station,
        destination_name,
        travel_date,
        class: travel_class,
        passenger_name,
        age,
        gender
    } = req.body;

    // Generate PNR number (current timestamp + random number)
    const pnr_number = 'PNR' + Date.now() + Math.floor(Math.random() * 1000);

    // Format dates properly for MySQL
    const formatDateForMySQL = (dateStr) => {
        // If the date is already in YYYY-MM-DD format, return it as is
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }
        // Otherwise, create a new Date object and format it
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    };

    // Format train number - just use the number without extra quotes
    const formatted_train_number = train_number;

    // Hardcoded values for now
    const user_id = 1; // Assuming user ID 1 exists
    const date_of_book = formatDateForMySQL(new Date()); // Current date
    const travel_date_formatted = formatDateForMySQL(travel_date);
    const transaction_id = 'TXN' + Date.now(); // Generate unique transaction ID
    const ticket_type = 'online';
    const payment_mode = 'UPI';
    const status = 'CONFIRMED';

    // Calculate fare based on class (simplified calculation)
    let total_fare = 0;
    switch (travel_class) {
        case '1A':
            total_fare = 2000;
            break;
        case '2A':
            total_fare = 1500;
            break;
        case '3A':
            total_fare = 1000;
            break;
        case 'SL':
            total_fare = 500;
            break;
        case 'CC':
            total_fare = 300;
            break;
        default:
            total_fare = 200;
    }

    // Map class codes to ticket_class enum values
    const classMapping = {
        '1A': 'first_ac',
        '2A': 'second_ac',
        '3A': 'third_ac',
        'SL': 'sleeper',
        'CC': 'general'
    };

    const ticket_class = classMapping[travel_class];

    // Insert ticket record
    const insertTicketQuery = `
        INSERT INTO ticket (
            pnr_number,
            train_number,
            user_id,
            date_of_book,
            boarding_station,
            destination_station,
            date_of_travel,
            ticket_class,
            total_fare,
            transaction_id,
            ticket_type,
            payment_mode,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertTicketQuery, [
        pnr_number,
        formatted_train_number,
        user_id,
        date_of_book,
        source_station,
        destination_station,
        travel_date_formatted,
        ticket_class,
        total_fare,
        transaction_id,
        ticket_type,
        payment_mode,
        status
    ], (err, result) => {
        if (err) {
            console.error('Error creating ticket:', err);

            // Check for seat availability error
            if (err.sqlState === '45000') {
                return res.status(400).json({
                    success: false,
                    message: err.sqlMessage
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error creating ticket'
            });
        }

        res.json({
            success: true,
            message: 'Ticket booked successfully',
            ticket_details: {
                pnr_number,
                train_number: formatted_train_number,
                train_name,
                source_station: source_name,
                destination_station: destination_name,
                travel_date: travel_date_formatted,
                ticket_class,
                total_fare,
                status
            }
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 