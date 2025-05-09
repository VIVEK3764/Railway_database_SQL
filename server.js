const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database configuration
const db = mysql.createConnection({
    host: "mysql-3692d36b-smartrail.j.aivencloud.com",
    port: 27353, // default Aiven MySQL SSL port
    user: "avnadmin",
    password: "AVNS_BAxgJ-qhLWgZkImZVka",
    database: "defaultdb",
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

// Route to get ticket details by PNR
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
// app.get('/ticket-details', async (req, res) => {
//     const pnr = req.query.pnr;

//     if (!pnr) {
//         return res.json({ success: false, message: 'PNR number is required' });
//     }

//     try {
//         // Get ticket details with train information
//         const [ticketRows] = await db.promise().query(
//             `SELECT 
//                 t.pnr_number,
//                 t.train_number,
//                 t.user_id,
//                 DATE_FORMAT(t.date_of_book, '%Y-%m-%d') as booking_date,
//                 t.boarding_station,
//                 t.destination_station,
//                 DATE_FORMAT(t.date_of_travel, '%Y-%m-%d') as journey_date,
//                 t.no_of_passenger,
//                 t.ticket_class,
//                 t.total_fare,
//                 t.transaction_id,
//                 t.ticket_type,
//                 t.payment_mode,
//                 t.status,
//                 tr.train_name
//             FROM ticket t 
//             JOIN train tr ON t.train_number = tr.train_number 
//             WHERE t.pnr_number = ?`,
//             [pnr]
//         );

//         if (ticketRows.length === 0) {
//             return res.json({ success: false, message: 'Ticket not found' });
//         }

//         const ticket = ticketRows[0];

//         // Get passenger details
//         const [passengerRows] = await db.promise().query(
//             'SELECT passenger_name, age, gender, seat_number, coach FROM passenger WHERE pnr_number = ?',
//             [pnr]
//         );

//         // Calculate fare details
//         const baseFarePerPassenger = parseFloat(ticket.total_fare) / ticket.no_of_passenger;

//         res.json({
//             success: true,
//             booking_id: ticket.pnr_number,
//             journey_details: {
//                 train_number: `'${ticket.train_number}'`,
//                 train_name: ticket.train_name,
//                 date_of_journey: ticket.journey_date,
//                 from_station: ticket.boarding_station,
//                 to_station: ticket.destination_station,
//                 class: ticket.ticket_class,
//                 booking_date: ticket.booking_date,
//                 status: ticket.status,
//                 ticket_type: ticket.ticket_type,
//                 payment_mode: ticket.payment_mode,
//                 transaction_id: ticket.transaction_id
//             },
//             passenger_details: passengerRows.map(passenger => ({
//                 name: passenger.passenger_name || 'undefined',
//                 age: passenger.age || '',
//                 gender: passenger.gender || 'Other',
//                 coach: passenger.coach || '',
//                 seat_no: passenger.seat_number || ''
//             })),
//             fare_details: {
//                 base_fare_per_passenger: baseFarePerPassenger.toFixed(2),
//                 number_of_passengers: ticket.no_of_passenger,
//                 total_fare: parseFloat(ticket.total_fare).toFixed(2)
//             }
//         });

//     } catch (error) {
//         console.error('Database error:', error);
//         res.json({ success: false, message: 'Error fetching ticket details' });
//     }
// });

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
        const payment_mode = req.body.payment_mode;
        const status = 'WAITLISTED';

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