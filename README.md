# Railway Database System

A comprehensive railway management system built with Node.js, Express, and MySQL. This system provides functionality for user registration and train search operations.

## Features

- User Registration System
- Train Search by Station
- Route Information Management
- Real-time Train Schedule Tracking

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Frontend**: HTML, CSS, JavaScript
- **Dependencies**:
  - express: ^4.18.2
  - mysql2: ^3.6.5
  - cors: ^2.8.5
  - dotenv: ^16.4.1

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file in the root directory
   - Add the following variables:
     ```
     DB_HOST=localhost
     DB_USER=your_mysql_username
     DB_PASSWORD=your_mysql_password
     DB_NAME=smart_rail
     ```
4. Configure MySQL database:
   - Create a database named 'smart_rail'
5. Start the server:
   ```bash
   npm start
   ```
6. Access the application at http://localhost:3000

## Database Features

The system includes stored procedures for:
- Searching trains by station codes
- Searching trains by station names
- Route management with distance calculations
- Train schedule management

## Project Structure

- `server.js` - Main application server
- `public/` - Static files and frontend assets
- `templates/` - HTML templates
- `QUERY.txt` - Database procedures and data loading scripts
- `.env` - Environment variables configuration

## Security Note

The application uses environment variables for sensitive information. Make sure to:
1. Never commit the `.env` file to version control
2. Keep your database credentials secure
3. Use different credentials for development and production environments
