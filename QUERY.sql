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
    SET new_date = CURDATE() + INTERVAL 1 DAY;
    
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
    WHERE travel_date < CURDATE() - INTERVAL 30 DAY;
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