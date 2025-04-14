DELIMITER $$
CREATE PROCEDURE search_train_by_station(
    IN SRC VARCHAR(10), 
    IN DEST VARCHAR(10), 
    IN travel_date DATE
)
BEGIN
    SELECT DISTINCT t.train_number, t.train_name, r1.departure_time as arrival_time, r2.arrival_time as departure_time,r2.distance-r1.distance as distance
    FROM route AS r1
    JOIN route AS r2 ON r1.train_number = r2.train_number
    JOIN train AS t ON t.train_number = r1.train_number
    WHERE r1.station_code = SRC
      AND r2.station_code = DEST
      AND r1.islno < r2.islno
      AND LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(travel_date, '%a')), '%');
END $$
DELIMITER ;


DELIMITER $$

CREATE PROCEDURE search_train_by_station1(
    IN SRC VARCHAR(10), 
    IN DEST VARCHAR(10), 
    IN travel_date DATE
)
BEGIN
    SELECT DISTINCT 
        t.train_number, 
        t.train_name, 
        r1.departure_time AS departure_time, 
        r2.arrival_time AS arrival_time,
        r2.distance - r1.distance AS distance,
        CASE 
            WHEN LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(travel_date, '%a')), '%') 
                THEN travel_date
            WHEN LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 1 DAY), '%a')), '%') 
                THEN DATE_ADD(travel_date, INTERVAL 1 DAY)
            WHEN LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 2 DAY), '%a')), '%') 
                THEN DATE_ADD(travel_date, INTERVAL 2 DAY)
        END AS actual_travel_date
    FROM route AS r1
    JOIN route AS r2 ON r1.train_number = r2.train_number
    JOIN train AS t ON t.train_number = r1.train_number
    WHERE r1.station_code = SRC
      AND r2.station_code = DEST
      AND r1.islno < r2.islno
      AND (
          LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(travel_date, '%a')), '%')
          OR LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 1 DAY), '%a')), '%')
          OR LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 2 DAY), '%a')), '%')
      );
END $$

DELIMITER ;



DELIMITER $$

CREATE PROCEDURE search_train_by_station2(
    IN partial_SRC VARCHAR(50), 
    IN partial_DEST VARCHAR(50), 
    IN travel_date DATE
)
BEGIN
    DECLARE SRC_CODE VARCHAR(10);
    DECLARE DEST_CODE VARCHAR(10);
    
    -- Fetch station codes based on partial station names
    SELECT station_code INTO SRC_CODE FROM station WHERE station_name LIKE CONCAT( partial_SRC, '%') LIMIT 1;
    SELECT station_code INTO DEST_CODE FROM station WHERE station_name LIKE CONCAT( partial_DEST, '%') LIMIT 1;

    -- Fetch train details
    SELECT DISTINCT 
        t.train_number, 
        t.train_name, 
        r1.station_code AS source_code, 
        (SELECT station_name FROM station WHERE station_code = r1.station_code) AS source_name,
        r2.station_code AS destination_code, 
        (SELECT station_name FROM station WHERE station_code = r2.station_code) AS destination_name,
        r1.departure_time AS departure_time, 
        r2.arrival_time AS arrival_time,
        r2.distance - r1.distance AS distance,
        CASE 
            WHEN LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(travel_date, '%a')), '%') 
                THEN travel_date
            WHEN LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 1 DAY), '%a')), '%') 
                THEN DATE_ADD(travel_date, INTERVAL 1 DAY)
            WHEN LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 2 DAY), '%a')), '%') 
                THEN DATE_ADD(travel_date, INTERVAL 2 DAY)
        END AS actual_travel_date
    FROM route AS r1
    JOIN route AS r2 ON r1.train_number = r2.train_number
    JOIN train AS t ON t.train_number = r1.train_number
    WHERE r1.station_code = SRC_CODE
      AND r2.station_code = DEST_CODE
      AND r1.islno < r2.islno
      AND (
          LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(travel_date, '%a')), '%')
          OR LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 1 DAY), '%a')), '%')
          OR LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(DATE_ADD(travel_date, INTERVAL 2 DAY), '%a')), '%')
      )
      ORDER BY actual_travel_date;
END $$

DELIMITER ;





LOAD DATA LOCAL INFILE 'C:\\Users\\gkrmv\\Downloads\\route_data_cleaned (1).csv'
INTO TABLE route
FIELDS TERMINATED BY ','  
ENCLOSED BY '"'  
LINES TERMINATED BY '\n'  
IGNORE 1 ROWS  
(train_number, islno, station_code, arrival_time, departure_time, distance);


---query for ticket booking

DELIMITER $$

CREATE TRIGGER before_ticket_insert
BEFORE INSERT ON ticket
FOR EACH ROW
BEGIN
    DECLARE avail INT DEFAULT 0;
    
    -- Check based on the booked class:
    IF NEW.ticket_class = 'first_ac' THEN
        SELECT first_ac_available INTO avail 
        FROM train_inventory 
        WHERE train_number = NEW.train_number AND travel_date = NEW.date_of_travel;
        
    ELSEIF NEW.ticket_class = 'second_ac' THEN
        SELECT second_ac_available INTO avail 
        FROM train_inventory 
        WHERE train_number = NEW.train_number AND travel_date = NEW.date_of_travel;
        
    ELSEIF NEW.ticket_class = 'third_ac' THEN
        SELECT third_ac_available INTO avail 
        FROM train_inventory 
        WHERE train_number = NEW.train_number AND travel_date = NEW.date_of_travel;
        
    ELSEIF NEW.ticket_class = 'sleeper' THEN
        SELECT sleeper_available INTO avail 
        FROM train_inventory 
        WHERE train_number = NEW.train_number AND travel_date = NEW.date_of_travel;
        
    ELSEIF NEW.ticket_class = 'general' THEN
        SELECT general_available INTO avail 
        FROM train_inventory 
        WHERE train_number = NEW.train_number AND travel_date = NEW.date_of_travel;
        
    ELSE
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Invalid seat class specified.';
    END IF;
    
    IF avail IS NULL OR avail <= 0 THEN
        SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'No available seats for the chosen class on this date.';
    END IF;
END $$

DELIMITER ;

--after insert trigger
DELIMITER $$

CREATE TRIGGER after_ticket_insert
AFTER INSERT ON ticket
FOR EACH ROW
BEGIN
    IF NEW.ticket_class = 'first_ac' THEN
        UPDATE train_inventory
        SET first_ac_available = first_ac_available - 1
        WHERE train_number = NEW.train_number
          AND travel_date = NEW.date_of_travel;
          
    ELSEIF NEW.ticket_class = 'second_ac' THEN
        UPDATE train_inventory
        SET second_ac_available = second_ac_available - 1
        WHERE train_number = NEW.train_number
          AND travel_date = NEW.date_of_travel;
          
    ELSEIF NEW.ticket_class = 'third_ac' THEN
        UPDATE train_inventory
        SET third_ac_available = third_ac_available - 1
        WHERE train_number = NEW.train_number
          AND travel_date = NEW.date_of_travel;
          
    ELSEIF NEW.ticket_class = 'sleeper' THEN
        UPDATE train_inventory
        SET sleeper_available = sleeper_available - 1
        WHERE train_number = NEW.train_number
          AND travel_date = NEW.date_of_travel;
          
    ELSEIF NEW.ticket_class = 'general' THEN
        UPDATE train_inventory
        SET general_available = general_available - 1
        WHERE train_number = NEW.train_number
          AND travel_date = NEW.date_of_travel;
    END IF;
END $$

DELIMITER ;


-- for updating train invertory daily
DELIMITER $$

CREATE PROCEDURE update_train_inventory()
BEGIN
    DECLARE new_date DATE;
    -- Define new_date as tomorrow
    SET new_date = CURDATE() + INTERVAL 30 DAY;
    
    -- Insert a new inventory record for new_date for all trains that run on that day
    INSERT IGNORE INTO train_inventory (
        train_number, travel_date, 
        first_ac_available, second_ac_available, third_ac_available, sleeper_available, general_available)
    SELECT 
        t.train_number, new_date,
        t.first_ac,
        t.second_ac,
        t.third_ac,
        t.sleeper,
        t.general
    FROM train t
    -- Check if the train runs on new_date, assuming runs_on_days stores concatenated day abbreviations (e.g., 'MonTueWed')
    WHERE LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(new_date, '%a')), '%');
    
    -- Delete any inventory records older than 30 days from today
    DELETE FROM train_inventory
    WHERE travel_date < CURDATE();
END $$

DELIMITER ;


--CREATING EVENT TO UPDATE INVENTORY DAILY
DELIMITER $$
CREATE EVENT update_train_inventory_daily
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    CALL update_train_inventory();
END $$



DELIMITER $$

CREATE PROCEDURE update_train_inventory_x(IN date DATE)
BEGIN
    DECLARE new_date DATE;
    -- Define new_date as tomorrow
    SET new_date = date;
    
    -- Insert a new inventory record for new_date for all trains that run on that day
    INSERT IGNORE INTO train_inventory (
        train_number, travel_date, 
        first_ac_available, second_ac_available, third_ac_available, sleeper_available, general_available)
    SELECT 
        t.train_number, new_date,
        t.first_ac,
        t.second_ac,
        t.third_ac,
        t.sleeper,
        t.general
    FROM train t
    -- Check if the train runs on new_date, assuming runs_on_days stores concatenated day abbreviations (e.g., 'MonTueWed')
    WHERE LOWER(t.runs_on_days) LIKE CONCAT('%', LOWER(DATE_FORMAT(new_date, '%a')), '%');
    
    -- Delete any inventory records older than 30 days from today
    -- DELETE FROM train_inventory
    -- WHERE travel_date < CURDATE() - INTERVAL 30 DAY;
END $$

DELIMITER ;



LOAD DATA LOCAL INFILE 'C:\Users\gkrmv\Downloads\schedules_proccesed.csv'
INTO TABLE train_shedule
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;


--fi=or updating seat count while booking
DELIMITER $$

CREATE PROCEDURE update_seat(
    IN in_train_number VARCHAR(10),
    IN in_date DATE,
    IN in_passenger_count INT,
    IN in_class VARCHAR(20)
)
BEGIN
    DECLARE current_seats INT DEFAULT 0;
    
    IF in_class = 'first_ac' THEN
        SELECT first_ac_available INTO current_seats 
        FROM train_inventory 
        WHERE train_number = in_train_number AND travel_date = in_date
        FOR UPDATE;
        
        IF current_seats < in_passenger_count THEN
            SIGNAL SQLSTATE '45000' 
                SET MESSAGE_TEXT = 'Not enough seats available in first_ac.';
        ELSE
            UPDATE train_inventory
            SET first_ac_available = first_ac_available - in_passenger_count
            WHERE train_number = in_train_number AND travel_date = in_date;
        END IF;
        
    ELSEIF in_class = 'second_ac' THEN
        SELECT second_ac_available INTO current_seats 
        FROM train_inventory 
        WHERE train_number = in_train_number AND travel_date = in_date
        FOR UPDATE;
        
        IF current_seats < in_passenger_count THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Not enough seats available in second_ac.';
        ELSE
            UPDATE train_inventory
            SET second_ac_available = second_ac_available - in_passenger_count
            WHERE train_number = in_train_number AND travel_date = in_date;
        END IF;
        
    ELSEIF in_class = 'third_ac' THEN
        SELECT third_ac_available INTO current_seats 
        FROM train_inventory 
        WHERE train_number = in_train_number AND travel_date = in_date
        FOR UPDATE;
        
        IF current_seats < in_passenger_count THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Not enough seats available in third_ac.';
        ELSE
            UPDATE train_inventory
            SET third_ac_available = third_ac_available - in_passenger_count
            WHERE train_number = in_train_number AND travel_date = in_date;
        END IF;
        
    ELSEIF in_class = 'sleeper' THEN
        SELECT sleeper_available INTO current_seats 
        FROM train_inventory 
        WHERE train_number = in_train_number AND travel_date = in_date
        FOR UPDATE;
        
        IF current_seats < in_passenger_count THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Not enough seats available in sleeper.';
        ELSE
            UPDATE train_inventory
            SET sleeper_available = sleeper_available - in_passenger_count
            WHERE train_number = in_train_number AND travel_date = in_date;
        END IF;
        
    ELSEIF in_class = 'general' THEN
        SELECT general_available INTO current_seats 
        FROM train_inventory 
        WHERE train_number = in_train_number AND travel_date = in_date
        FOR UPDATE;
        
        IF current_seats < in_passenger_count THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Not enough seats available in general.';
        ELSE
            UPDATE train_inventory
            SET general_available = general_available - in_passenger_count
            WHERE train_number = in_train_number AND travel_date = in_date;
        END IF;
        
    ELSE
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid ticket class specified.';
    END IF;
    
END $$

DELIMITER ;

DELIMITER $$
CREATE PROCEDURE check_pnr_status(IN in_pnr_number VARCHAR(20))
BEGIN
    SELECT train_number,date_of_travel,boarding_station,destination_station,ticket_class,no_of_passenger,status FROM ticket WHERE pnr_number = in_pnr_number;
END $$

DELIMITER ;

DELIMITER $$
CREATE PROCEDURE train_shedule_lookup(IN in_train_number VARCHAR(10))
BEGIN
    SELECT train_number,train_name,runs_on_days FROM train WHERE train_number = in_train_number;
    SELECT islno,station_code,arrival_time,departure_time,distance FROM route WHERE train_number = in_train_number;
END $$

DELIMITER ; 

DELIMITER $$
CREATE PROCEDURE check_seat_availability(IN in_train_number VARCHAR(10),IN in_date DATE,IN in_class VARCHAR(10))
BEGIN
    DECLARE available_seats INT;
    
    if(in_class = 'first_ac') then
        SELECT first_ac_available INTO available_seats FROM train_inventory WHERE train_number = in_train_number AND travel_date = in_date;
    elseif(in_class = 'second_ac') then
        SELECT second_ac_available INTO available_seats FROM train_inventory WHERE train_number = in_train_number AND travel_date = in_date;
    elseif(in_class = 'third_ac') then
        SELECT third_ac_available INTO available_seats FROM train_inventory WHERE train_number = in_train_number AND travel_date = in_date;
    elseif(in_class = 'sleeper') then
        SELECT sleeper_available INTO available_seats FROM train_inventory WHERE train_number = in_train_number AND travel_date = in_date;
    elseif(in_class = 'general') then
        SELECT general_available INTO available_seats FROM train_inventory WHERE train_number = in_train_number AND travel_date = in_date;
    end if;
    SELECT available_seats;
   
END $$

DELIMITER ;

--lisiting all passenger on a trainon particular date
DELIMITER $$
CREATE PROCEDURE list_passengers_on_train(IN in_train_number VARCHAR(10), IN in_date DATE,IN in_status VARCHAR(20))
BEGIN
    if(in_status = 'all') then
        SELECT ticket.pnr_number,passenger_name,ticket_class,age,gender,seat_number,coach,status FROM ticket,passenger WHERE ticket.train_number = in_train_number AND ticket.date_of_travel = in_date AND ticket.pnr_number=passenger.pnr_number;
    else
        SELECT ticket.pnr_number,passenger_name,ticket_class,age,gender,seat_number,coach,status FROM ticket,passenger WHERE ticket.train_number = in_train_number AND ticket.date_of_travel = in_date AND ticket.pnr_number=passenger.pnr_number AND ticket.status = in_status;
    end if;
END $$

DELIMITER ;








