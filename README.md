# Railway Reservation System

A comprehensive web-based railway reservation system that allows users to search trains, book tickets, check PNR status, and manage their bookings.

## Features

### 1. Train Search
- Search trains between stations using partial station names
- View detailed train information including arrival/departure times
- Real-time availability checking
- Multiple search filters

### 2. Ticket Booking
- User-friendly booking interface
- Multiple passenger booking support
- Concession categories:
  - Senior Citizen (25% off)
  - Student (15% off)
  - Disabled (25% off)
- Multiple payment options:
  - UPI
  - Digital Wallet (Paytm, PhonePe, Google Pay, Amazon Pay)
  - Net Banking
  - Debit/Credit Card
- Automatic seat allocation
- Instant booking confirmation

### 3. User Management
- User registration and profile management
- Booking history
- Easy ticket cancellation
- PNR status checking

### 4. Additional Features
- Train schedule lookup
- Seat availability checking
- Passenger list viewing
- Real-time booking status
- Multiple class options (Sleeper, AC, General)

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Other Tools**: 
  - dotenv (environment variables)
  - cors (Cross-Origin Resource Sharing)

## Prerequisites

Before running this project, make sure you have the following installed:
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm (Node Package Manager)

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd Railway_database_SQL
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   - Create a MySQL database named 'smart_rail'
   - Import the database schema:
     ```bash
     mysql -u your_username -p smart_rail < database.sql
     mysql -u your_username -p smart_rail < QUERY_final.sql
     ```

4. **Environment Configuration**
   - Create a .env file in the root directory
   - Add the following configurations:
     ```
     DB_HOST=localhost
     DB_USER=your_username
     DB_PASSWORD=your_password
     DB_NAME=smart_rail
     PORT=3000
     ```

5. **Start the Server**
   ```bash
   node server.js
   ```

6. **Access the Application**
   - Open your browser and navigate to `http://localhost:3000`
   - The application should now be running and accessible

## API Endpoints

### Train Operations
- `POST /search-trains` - Search trains between stations
- `GET /train-schedule` - Get train schedule
- `GET /check-availability` - Check seat availability

### Booking Operations
- `POST /book-ticket` - Book a new ticket
- `GET /ticket-details` - Get ticket details
- `POST /cancel-ticket` - Cancel a ticket
- `GET /pnr-status` - Check PNR status

### User Operations
- `POST /insert_user` - Register a new user
- `GET /passenger-list` - Get passenger list for a train

## Database Schema

### Main Tables
1. **user**
   - User registration information
   
2. **train**
   - Train details and schedules
   
3. **ticket**
   - Booking information
   
4. **passenger**
   - Passenger details with concession types

## Fare Structure

### Base Fares
- Sleeper (SL): ₹500
- Third AC (3A): ₹1000
- Second AC (2A): ₹1500
- First AC (1A): ₹2000
- General (GN): ₹300

### Concession Rates
- Senior Citizen: 25% off
- Disabled: 25% off
- Student: 15% off

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Error Handling

The system includes comprehensive error handling for:
- Invalid inputs
- Database connection issues
- Booking conflicts
- Payment failures
- Server errors

## Security Features

- Input validation
- SQL injection prevention
- Cross-Origin Resource Sharing (CORS)
- Secure payment handling
- Environment variable protection

## Future Enhancements

- User authentication and authorization
- Mobile responsive design
- Email notifications
- SMS alerts for booking updates
- Multiple language support
- Advanced search filters
- Waitlist management
- Real-time seat mapping

## Support

For support, email vivek_2301cs63@iitp.ac.in or create an issue in the repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
