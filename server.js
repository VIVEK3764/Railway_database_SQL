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

// Get ticket details endpoint
app.get('/ticket-details', (req, res) => {
    const pnr = req.query.pnr;

    // First get the ticket details
    const ticketQuery = `
        SELECT t.*, tr.train_name 
        FROM ticket t
        JOIN train tr ON t.train_number = tr.train_number
        WHERE t.pnr_number = ?
    `;

    db.query(ticketQuery, [pnr], (err, ticketResults) => {
        if (err) {
            console.error('Error fetching ticket details:', err);
            return res.status(500).json({ success: false, message: 'Error fetching ticket details' });
        }

        if (ticketResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const ticket = ticketResults[0];

        // Then get the passenger details
        const passengerQuery = `
            SELECT passenger_id, passenger_name as name, pnr_number, age, gender, 
                   seat_number, coach
            FROM passenger 
            WHERE pnr_number = ?
            ORDER BY passenger_id
        `;

        db.query(passengerQuery, [pnr], (err, passengerResults) => {
            if (err) {
                console.error('Error fetching passenger details:', err);
                return res.status(500).json({ success: false, message: 'Error fetching passenger details' });
            }

            res.json({
                success: true,
                ticket,
                passengers: passengerResults
            });
        });
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

    const travel_date_formatted = formatDateForMySQL(travel_date);

    // First, check seat availability in train_inventory
    const checkInventoryQuery = `
        SELECT 
            first_ac_available,
            second_ac_available,
            third_ac_available,
            sleeper_available,
            general_available
        FROM train_inventory 
        WHERE train_number = ? 
        AND travel_date = ?
    `;

    db.query(checkInventoryQuery, [train_number, travel_date_formatted], (err, inventoryResults) => {
        if (err) {
            console.error('Error checking inventory:', err);
            return res.status(500).json({ error: 'Failed to check seat availability' });
        }

        // If no inventory record exists, return error
        if (inventoryResults.length === 0) {
            return res.status(400).json({ error: 'No inventory available for this train on selected date' });
        }

        const inventory = inventoryResults[0];

        // Get the available seats for the selected class
        const availabilityMap = {
            'first_ac': inventory.first_ac_available,
            'second_ac': inventory.second_ac_available,
            'third_ac': inventory.third_ac_available,
            'sleeper': inventory.sleeper_available,
            'general': inventory.general_available
        };

        const seatsAvailable = availabilityMap[ticket_class];
        const seatsNeeded = passengers.length;

        if (!seatsAvailable) {
            return res.status(400).json({ error: 'Invalid class selected' });
        }

        if (seatsAvailable < seatsNeeded) {
            return res.status(400).json({ error: 'Not enough seats available in selected class' });
        }

        // Calculate the last seat number based on class and available seats
        const totalSeatsPerClass = {
            'first_ac': 72,
            'second_ac': 72,
            'third_ac': 216,
            'sleeper': 432,
            'general': 72
        };

        const maxSeats = totalSeatsPerClass[ticket_class];
        const seatsBooked = totalSeatsPerClass[ticket_class] - seatsAvailable;
        let lastSeatNumber = seatsBooked;

        // Proceed with booking
        proceedWithBooking(seatsAvailable, lastSeatNumber, maxSeats);
    });

    function proceedWithBooking(seatsAvailable, lastSeatNumber, maxSeats) {
        const seatsNeeded = passengers.length;

        // Hardcoded values
        const user_id = 1;
        const date_of_book = formatDateForMySQL(new Date());
        const transaction_id = 'TXN' + Date.now();
        const ticket_type = 'online';
        const payment_mode = 'UPI';
        const status = 'CONFIRMED';

        // Calculate fare
        const classFares = {
            'sleeper': 500,
            'third_ac': 1000,
            'second_ac': 1500,
            'first_ac': 2000,
            'general': 300
        };

        const baseFare = classFares[ticket_class] || 500;
        const total_fare = passengers.length * baseFare;

        // Create the ticket
        const createTicketQuery = `
            INSERT INTO ticket (
                pnr_number, train_number, user_id, date_of_book, boarding_station,
                destination_station, date_of_travel, no_of_passenger, ticket_class,
                total_fare, transaction_id, ticket_type, payment_mode, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

            // Insert passenger details
            const insertPassengerQuery = `
                INSERT INTO passenger (passenger_name, pnr_number, age, gender, seat_number, coach)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            // Insert each passenger with proper seat numbering
            const passengerPromises = passengers.map(passenger => {
                lastSeatNumber++;
                const seatNumber = lastSeatNumber % maxSeats || maxSeats;
                const coachNumber = Math.ceil(lastSeatNumber / maxSeats);
                const formattedSeatNumber = seatNumber.toString().padStart(2, '0');
                const formattedCoachNumber = `C${coachNumber.toString().padStart(2, '0')}`;

                return new Promise((resolve, reject) => {
                    db.query(insertPassengerQuery,
                        [passenger.name, pnr_number, passenger.age, passenger.gender.charAt(0).toUpperCase(),
                            formattedSeatNumber, formattedCoachNumber],
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

            // Update train inventory based on class using stored procedure
            const updateInventoryQuery = `
                CALL update_seat(?, ?, ?, ?)
            `;

            // Wait for all passenger insertions to complete
            Promise.all(passengerPromises)
                .then(() => {
                    // Update inventory using stored procedure
                    db.query(updateInventoryQuery,
                        [train_number, travel_date_formatted, seatsNeeded, ticket_class],
                        (err, result) => {
                            if (err) {
                                console.error('Error updating inventory:', err);
                                return res.status(500).json({ error: 'Failed to update inventory' });
                            }
                            res.json({
                                success: true,
                                pnr_number,
                                redirect_url: `/show-ticket.html?pnr=${pnr_number}`
                            });
                        }
                    );
                })
                .catch(err => {
                    console.error('Error inserting passenger details:', err);
                    res.status(500).json({ error: 'Failed to create passenger details' });
                });
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
    const trainNumber = req.query.train_number;
    const travelDate = req.query.travel_date;
    const ticketClass = req.query.class;

    if (!trainNumber || !travelDate || !ticketClass) {
        return res.status(400).json({ success: false, message: 'All parameters are required' });
    }

    // Add quotes around the train number as required by the procedure
    const formattedTrainNumber = `'${trainNumber}'`;
    const query = 'CALL check_seat_availability(?, ?, ?)';

    db.query(query, [formattedTrainNumber, travelDate, ticketClass], (err, results) => {
        if (err) {
            console.error('Error checking seat availability:', err);
            return res.status(500).json({ success: false, message: 'Error checking seat availability' });
        }

        if (!results || !results[0] || results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'No availability information found' });
        }

        res.json({
            success: true,
            available_seats: results[0][0].available_seats
        });
    });
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

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 