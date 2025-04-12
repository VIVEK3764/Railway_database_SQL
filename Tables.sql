CREATE TABLE train_inventory (
    train_number VARCHAR(10) NOT NULL,
    travel_date DATE NOT NULL,
    first_ac_available INT DEFAULT 0,
    second_ac_available INT DEFAULT 0,
    third_ac_available INT DEFAULT 0,
    sleeper_available INT DEFAULT 0,
    general_available INT DEFAULT 0,
    PRIMARY KEY (train_number, travel_date),
    FOREIGN KEY (train_number) REFERENCES train(train_number) ON DELETE CASCADE
);
