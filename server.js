const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Database configuration
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: 27353, // default Aiven MySQL SSL port
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        ca: fs.readFileSync('./ca (1).pem')  // path to your downloaded Aiven CA certificate
    }
});
// const db = mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME
// });

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

// Serve the ticket details page
app.get('/show-ticket.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'show-ticket.html'));
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
app.post('/insert_user', async (req, res) => {
    const { user_name, age, gender, phone_number, email_id, password } = req.body;

    try {
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const sql = 'INSERT INTO user (user_name, age, gender, phone_number, email_id, password) VALUES (?, ?, ?, ?, ?, ?)';
        const values = [user_name, age, gender, phone_number, email_id, hashedPassword];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error inserting data:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    if (err.message.includes('phone_number')) {
                        return res.status(400).json({ success: false, message: 'Phone number already registered' });
                    }
                    if (err.message.includes('email_id')) {
                        return res.status(400).json({ success: false, message: 'Email already registered' });
                    }
                }
                return res.status(500).json({ success: false, message: 'Error registering user' });
            }
            res.json({ success: true, message: 'User registered successfully' });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({ success: false, message: 'Error processing registration' });
    }
});

// Route to get ticket details by PNR
app.get('/ticket-details', async (req, res) => {
    const pnr = req.query.pnr;

    if (!pnr) {
        return res.status(400).json({
            success: false,
            message: 'PNR number is required'
        });
    }

    try {
        // Get ticket details with train information
        const [ticketRows] = await db.promise().query(
            `SELECT 
                t.pnr_number,
                t.train_number,
                t.user_id,
                DATE_FORMAT(t.date_of_book, '%Y-%m-%d') as date_of_book,
                t.boarding_station,
                t.destination_station,
                DATE_FORMAT(t.date_of_travel, '%Y-%m-%d') as date_of_travel,
                t.no_of_passenger,
                t.ticket_class,
                t.total_fare,
                t.transaction_id,
                t.ticket_type,
                t.payment_mode,
                t.status,
                tr.train_name
            FROM ticket t 
            JOIN train tr ON t.train_number = tr.train_number 
            WHERE t.pnr_number = ?`,
            [pnr]
        );

        if (ticketRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        const ticket = ticketRows[0];

        // Get passenger details
        const [passengerRows] = await db.promise().query(
            `SELECT 
                passenger_name as name,
                age,
                gender,
                seat_number,
                coach
            FROM passenger 
            WHERE pnr_number = ?
            ORDER BY passenger_id`,
            [pnr]
        );

        res.json({
            success: true,
            ticket: {
                pnr_number: ticket.pnr_number,
                train_number: ticket.train_number,
                train_name: ticket.train_name,
                date_of_book: ticket.date_of_book,
                boarding_station: ticket.boarding_station,
                destination_station: ticket.destination_station,
                date_of_travel: ticket.date_of_travel,
                no_of_passenger: ticket.no_of_passenger,
                ticket_class: ticket.ticket_class,
                total_fare: ticket.total_fare,
                transaction_id: ticket.transaction_id,
                ticket_type: ticket.ticket_type,
                payment_mode: ticket.payment_mode,
                status: ticket.status
            },
            passengers: passengerRows
        });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching ticket details'
        });
    }
});

// Route to cancel ticket
app.post('/cancel-ticket', async (req, res) => {
    const { pnr } = req.body;

    if (!pnr) {
        return res.json({ success: false, message: 'PNR number is required' });
    }

    try {
        // Start a transaction
        await db.promise().query('START TRANSACTION');

        // Update ticket status
        // await db.promise().query(
        //     'UPDATE ticket SET status = "CANCELLED" WHERE pnr_number = ?',
        //     [pnr]
        // );
        await db.promise().query(
            'call cancel_ticket(?)',
            [pnr]
        );

        // Update passenger status
        // await db.promise().query(
        //     'UPDATE passenger SET status = "CANCELLED" WHERE pnr_number = ?',
        //     [pnr]
        // );

        // Commit the transaction
        await db.promise().query('COMMIT');

        res.json({ success: true, message: 'Ticket cancelled successfully' });

    } catch (error) {
        // Rollback in case of error
        await db.promise().query('ROLLBACK');
        console.error('Database error:', error);
        res.json({ success: false, message: 'Error cancelling ticket' });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { email_id, password } = req.body;

    try {
        // Get user from database
        const [users] = await db.promise().query(
            'SELECT * FROM user WHERE email_id = ?',
            [email_id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = users[0];

        // Compare password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Set user session
        req.session.user = {
            user_id: user.user_id,
            user_name: user.user_name,
            email_id: user.email_id
        };

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                user_id: user.user_id,
                user_name: user.user_name,
                email_id: user.email_id
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
});

// Middleware to check if user is logged in
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Please login to continue'
        });
    }
    next();
};

// Book ticket endpoint (protected)
app.post('/book-ticket', requireLogin, async (req, res) => {
    const {
        train_number,
        source_station,
        destination_station,
        travel_date,
        passengers,
        ticket_class,
        ticket_type = 'online',
        payment_mode = 'online'
    } = req.body;

    try {
        // Start a transaction
        await db.promise().beginTransaction();

        // Generate PNR number (10 digits)
        const pnr = Math.floor(1000000000 + Math.random() * 9000000000).toString();

        // Generate transaction ID (format: TXN + timestamp + random 4 digits)
        const timestamp = Date.now();
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const transaction_id = `TXN${timestamp}${randomDigits}`;

        // Calculate total fare (example calculation - you should adjust based on your fare rules)
        const baseFare = 500; // Base fare per passenger
        const totalFare = baseFare * passengers.length;

        // Format the travel date to ensure it's in YYYY-MM-DD format
        const formatDateForMySQL = (dateStr) => {
            try {
                if (typeof dateStr !== 'string') {
                    dateStr = String(dateStr);
                }
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    return dateStr;
                }
                if (dateStr.includes('/')) {
                    const [day, month, year] = dateStr.split('/');
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
                if (dateStr instanceof Date) {
                    return dateStr.toISOString().split('T')[0];
                }
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
                throw new Error('Invalid date format');
            } catch (error) {
                console.error('Date formatting error:', error);
                return new Date().toISOString().split('T')[0];
            }
        };
        const formattedTravelDate = formatDateForMySQL(travel_date);

        // Insert ticket record with all required fields
        const [ticketResult] = await db.promise().query(
            `INSERT INTO ticket (
                pnr_number, train_number, user_id, date_of_book, 
                boarding_station, destination_station, date_of_travel,
                no_of_passenger, ticket_class, total_fare, transaction_id,
                ticket_type, payment_mode, status
            ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
            [
                pnr,
                train_number,
                req.session.user.user_id,
                source_station,
                destination_station,
                formattedTravelDate,
                passengers.length,
                ticket_class,
                totalFare,
                transaction_id,
                ticket_type,
                payment_mode
            ]
        );

        // Insert passenger records
        for (const passenger of passengers) {
            await db.promise().query(
                `INSERT INTO passenger (
                    pnr_number, passenger_name, age, gender, seat_number, coach
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    pnr,
                    passenger.name,
                    passenger.age,
                    passenger.gender,
                    passenger.seat_number || null,
                    passenger.coach || null
                ]
            );
        }

        // Commit the transaction
        await db.promise().commit();

        res.json({
            success: true,
            message: 'Ticket booked successfully',
            pnr: pnr,
            transaction_id: transaction_id,
            total_fare: totalFare,
            redirect_url: `/show-ticket.html?pnr=${pnr}`
        });

    } catch (error) {
        // Rollback the transaction in case of error
        await db.promise().rollback();
        console.error('Error booking ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to book ticket. Please try again.'
        });
    }
});

// PNR Status endpoint
app.get('/pnr-status', (req, res) => {
    const pnrNumber = req.query.pnr;

    if (!pnrNumber) {
        return res.status(400).json({ success: false, message: 'PNR number is required' });
    }

    const query = 'CALL check_pnr_status(?)';

    db.query(query, [pnrNumber], (err, results) => {
        if (err) {
            console.error('Error checking PNR status:', err);
            return res.status(500).json({ success: false, message: 'Error checking PNR status' });
        }

        if (results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'PNR not found' });
        }

        res.json({
            success: true,
            status: results[0][0]
        });
    });
});

// Train Schedule endpoint
app.get('/train-schedule', (req, res) => {
    const trainNumber = req.query.train_number;

    if (!trainNumber) {
        return res.status(400).json({ success: false, message: 'Train number is required' });
    }

    // Add quotes around the train number as required by the procedure
    const formattedTrainNumber = `'${trainNumber}'`;
    const query = 'CALL train_shedule_lookup(?)';

    db.query(query, [formattedTrainNumber], (err, results) => {
        if (err) {
            console.error('Error checking train schedule:', err);
            return res.status(500).json({ success: false, message: 'Error checking train schedule' });
        }

        if (!results || !results[0] || results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'Train not found' });
        }

        res.json({
            success: true,
            train_info: results[0],
            schedule: results[1]
        });
    });
});

// Check Seat Availability endpoint
app.get('/check-availability', (req, res) => {
    const formatDateForMySQL = (dateStr) => {
        try {
            if (!dateStr) {
                throw new Error('Date is required');
            }
            // If it's already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }
            // Convert to YYYY-MM-DD format
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date format');
            }
            return date.toISOString().split('T')[0];
        } catch (error) {
            console.error('Date formatting error:', error);
            throw error;
        }
    };

    try {
        const trainNumber = req.query.train_number;
        const travelDate = formatDateForMySQL(req.query.travel_date);
        const ticketClass = req.query.class;

        if (!trainNumber || !travelDate || !ticketClass) {
            return res.status(400).json({
                success: false,
                message: 'Train number, travel date, and class are required'
            });
        }

        // Add quotes around the train number as required by the procedure
        const formattedTrainNumber = `'${trainNumber}'`;
        const query = 'CALL check_seat_availability(?, ?, ?)';

        db.query(query, [formattedTrainNumber, travelDate, ticketClass], (err, results) => {
            if (err) {
                console.error('Error checking seat availability:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error checking seat availability'
                });
            }

            if (!results || !results[0] || results[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No availability information found for the specified train and date'
                });
            }

            const availableSeats = results[0][0].available_seats;

            if (availableSeats === null) {
                return res.status(404).json({
                    success: false,
                    message: 'No inventory record found for this train and date'
                });
            }

            res.json({
                success: true,
                available_seats: availableSeats
            });
        });
    } catch (error) {
        console.error('Error in check-availability:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error processing request'
        });
    }
});

// Passenger List endpoint
app.get('/passenger-list', (req, res) => {
    const trainNumber = req.query.train_number;
    const travelDate = req.query.travel_date;
    const status = req.query.status || 'all';

    if (!trainNumber || !travelDate) {
        return res.status(400).json({ success: false, message: 'Train number and travel date are required' });
    }

    // Add quotes around the train number as required by the procedure
    const formattedTrainNumber = `'${trainNumber}'`;
    const query = 'CALL list_passengers_on_train(?, ?, ?)';

    db.query(query, [formattedTrainNumber, travelDate, status], (err, results) => {
        if (err) {
            console.error('Error fetching passenger list:', err);
            return res.status(500).json({ success: false, message: 'Error fetching passenger list' });
        }

        if (!results || !results[0] || results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'No passengers found for this train on the specified date' });
        }

        res.json({
            success: true,
            passengers: results[0]
        });
    });
});

// Check login status endpoint
app.get('/check-login', (req, res) => {
    res.json({
        isLoggedIn: !!req.session.user,
        user: req.session.user || null
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 