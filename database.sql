CREATE TABLE passenger (
    passenger_id INT PRIMARY KEY AUTO_INCREMENT,
    passenger_name VARCHAR(100) NOT NULL,
    pnr_number VARCHAR(20) NOT NULL,
    age INT NOT NULL,
    gender CHAR(1) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    coach VARCHAR(10) NOT NULL,
    concession_type ENUM('none', 'senior', 'student', 'disabled') DEFAULT 'none',
    FOREIGN KEY (pnr_number) REFERENCES ticket(pnr_number)
); 