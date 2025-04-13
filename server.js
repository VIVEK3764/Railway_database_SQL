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
    const { train_number, source_station, destination_station, travel_date, ticket_class, passengers } = req.body;

    // Generate PNR number
    const pnr_number = 'PNR' + Math.random().toString(36).substr(2, 8).toUpperCase();

    // Format dates properly for MySQL
    const formatDateForMySQL = (dateStr) => {
        try {
            // If dateStr is not a string, convert it to string
            if (typeof dateStr !== 'string') {
                dateStr = String(dateStr);
            }

            // If it's already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }

            // If it's in DD/MM/YYYY format, convert to YYYY-MM-DD
            if (dateStr.includes('/')) {
                const [day, month, year] = dateStr.split('/');
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }

            // If it's a Date object
            if (dateStr instanceof Date) {
                return dateStr.toISOString().split('T')[0];
            }

            // Try to parse as date
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }

            throw new Error('Invalid date format');
        } catch (error) {
            console.error('Date formatting error:', error);
            return new Date().toISOString().split('T')[0]; // Return current date as fallback
        }
    };

    // Hardcoded values for now
    const user_id = 1; // Assuming user ID 1 exists
    const date_of_book = formatDateForMySQL(new Date());
    const travel_date_formatted = formatDateForMySQL(travel_date);
    const transaction_id = 'TXN' + Date.now();
    const ticket_type = 'online';
    const payment_mode = 'UPI';
    const status = 'CONFIRMED';

    // Calculate fare based on class
    const classFares = {
        'sleeper': 500,
        'third_ac': 1000,
        'second_ac': 1500,
        'first_ac': 2000,
        'general': 300
    };

    const baseFare = classFares[ticket_class] || 500;
    const total_fare = passengers.length * baseFare;

    // First, create the ticket
    const createTicketQuery = `
        INSERT INTO ticket (
            pnr_number, train_number, user_id, date_of_book, boarding_station,
            destination_station, date_of_travel, no_of_passenger, ticket_class,
            total_fare, transaction_id, ticket_type, payment_mode, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(createTicketQuery, [
        pnr_number, train_number, user_id, date_of_book, source_station,
        destination_station, travel_date_formatted, passengers.length, ticket_class,
        total_fare, transaction_id, ticket_type, payment_mode, status
    ], (err, result) => {
        if (err) {
            console.error('Error creating ticket:', err);
            return res.status(500).json({ error: 'Failed to create ticket' });
        }

        const ticket_id = result.insertId;

        // Insert passenger details
        const insertPassengerQuery = `
            INSERT INTO passenger (pnr_number, age, gender, seat_number, coach)
            VALUES (?, ?, ?, ?, ?)
        `;

        // Calculate seat and coach numbers
        const totalSeats = 73; // Total seats per coach
        let currentSeat = 1;

        // Insert each passenger
        const passengerPromises = passengers.map(passenger => {
            const seatNumber = currentSeat % totalSeats || totalSeats;
            const coachNumber = Math.ceil(currentSeat / totalSeats);
            currentSeat++;

            return new Promise((resolve, reject) => {
                db.query(insertPassengerQuery,
                    [pnr_number, passenger.age, passenger.gender, seatNumber.toString(), coachNumber.toString()],
                    (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    }
                );
            });
        });

        // Wait for all passenger insertions to complete
        Promise.all(passengerPromises)
            .then(() => {
                res.json({
                    success: true,
                    ticket_id,
                    pnr_number,
                    total_fare,
                    message: 'Ticket and passenger details created successfully'
                });
            })
            .catch(err => {
                console.error('Error inserting passenger details:', err);
                res.status(500).json({ error: 'Failed to create passenger details' });
            });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 