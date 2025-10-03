-- Set the character set for the entire database (recommended for MySQL)
-- CREATE DATABASE IF NOT EXISTS attendance_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE attendance_app;

-- Create the Lectures table (to group students/attendance)
CREATE TABLE Lectures (
    lecture_id VARCHAR(55) PRIMARY KEY NOT NULL,
    lecturer_email VARCHAR(100) UNIQUE NOT NULL, -- Used for login
    lecturer_name VARCHAR(100) NOT NULL,
    course_code VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB; -- Use InnoDB for transaction support and foreign keys

-- Create the Students table
CREATE TABLE Students (
    student_id VARCHAR(50) PRIMARY KEY NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    lecture_id VARCHAR(55) NOT NULL,
    -- MySQL uses the standard JSON type for flexible data storage.
    face_descriptor JSON, 
    CONSTRAINT FK_Students_Lectures FOREIGN KEY (lecture_id) REFERENCES Lectures (lecture_id)
) ENGINE=InnoDB;

-- Create the AttendanceRecords table
CREATE TABLE AttendanceRecords (
    -- MySQL standard syntax for an auto-incrementing integer primary key
    record_id INT AUTO_INCREMENT PRIMARY KEY, 
    student_id VARCHAR(50) NOT NULL,
    lecture_id VARCHAR(100) NOT NULL,
    lecture_date DATE NOT NULL,
    -- DATETIME or TIMESTAMP are common in MySQL. DATETIME is used here.
    check_in_time DATETIME NOT NULL DEFAULT NOW(), 
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    -- Store the path to the image (e.g., in cloud storage)
    image_path VARCHAR(255), 
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    CONSTRAINT FK_AttendanceRecords_Students FOREIGN KEY (student_id) REFERENCES Students (student_id),
    CONSTRAINT FK_AttendanceRecords_Lectures FOREIGN KEY (lecture_id) REFERENCES Lectures (lecture_id)
) ENGINE=InnoDB;

-- Insert initial lecturer data (your hardcoded credentials from index.html)
INSERT INTO Lectures (lecture_id, lecturer_email, lecturer_name, course_code) VALUES
('CS101_L1', 'ntuthukolwandisa@gmail.com', 'Ntuthuko Lwandisa', 'CS101');

-- You'll need to run this SQL script on your MySQL database instance.
