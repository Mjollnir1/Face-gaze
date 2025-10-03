CREATE TABLE Lectures (
    lecture_id VARCHAR(55) PRIMARY KEY NOT NULL,
    lecturer_email VARCHAR(100) UNIQUE NOT NULL,
    lecturer_name VARCHAR(100) NOT NULL,
    course_code VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB;
CREATE TABLE Students (
    student_id VARCHAR(50) PRIMARY KEY NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    lecture_id VARCHAR(55) NOT NULL,
    face_descriptor JSON,
    profile_image LONGTEXT,
    image_type VARCHAR(20) DEFAULT 'base64',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Students_Lectures FOREIGN KEY (lecture_id) REFERENCES Lectures (lecture_id)
) ENGINE=InnoDB;
CREATE TABLE AttendanceRecords (
    record_id INT AUTO_INCREMENT PRIMARY KEY, 
    student_id VARCHAR(50) NOT NULL,
    lecture_id VARCHAR(100) NOT NULL,
    lecture_date DATE NOT NULL,
    check_in_time DATETIME NOT NULL DEFAULT NOW(), 
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    check_in_image LONGTEXT,
    image_type VARCHAR(20) DEFAULT 'base64',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    CONSTRAINT FK_AttendanceRecords_Students FOREIGN KEY (student_id) REFERENCES Students (student_id),
    CONSTRAINT FK_AttendanceRecords_Lectures FOREIGN KEY (lecture_id) REFERENCES Lectures (lecture_id)
) ENGINE=InnoDB;
INSERT INTO Lectures (lecture_id, lecturer_email, lecturer_name, course_code) VALUES
('CS101_L1', 'ntuthukolwandisa@gmail.com', 'Ntuthuko Lwandisa', 'CS101');
