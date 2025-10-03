const express = require('express');
const mysql = require('mysql2/promise'); // Use 'mysql2/promise' for async/await
const bodyParser = require('body-parser');
const cors = require('cors'); 
const crypto = require('crypto'); // Used for generating session IDs

const app = express();
const port = 3000;

// Middleware setup
app.use(cors()); 
// Set a higher limit to handle potentially large face descriptor JSON arrays
app.use(bodyParser.json({ limit: '5mb' })); 
app.use(express.static('public')); 

// --- Database Configuration ---
// IMPORTANT: Replace these connection details with your actual MySQL credentials
const dbConfig = {
    host: 'localhost',
    user: 'your_db_user',
    password: 'your_db_password',
    database: 'your_db_name', // The database name where you ran mysql_schema.sql
    port: 3306, // Default MySQL port
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create the MySQL connection pool
let pool;
try {
    pool = mysql.createPool(dbConfig);
    console.log("MySQL pool created successfully.");
} catch (error) {
    console.error("Failed to create MySQL pool:", error);
    process.exit(1); // Exit if database connection fails
}

// A simple in-memory session store (replace with secure storage like Redis for production)
const sessions = new Map();

/**
 * Middleware to check if the lecturer is logged in
 */
function authenticateLecturer(req, res, next) {
    // The lecturer must send the session ID (token) in the header
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }
    req.lecturer = sessions.get(sessionId);
    next();
}

// --- API Endpoints ---

/**
 * POST /api/login - Handles Lecturer Login
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // WARNING: In a production app, never hardcode the password. 
    // You should use a library like bcrypt to hash passwords.
    const HARDCODED_PASSWORD = 'Noluthando@1'; // Check based on your provided index.html

    if (password !== HARDCODED_PASSWORD) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }

    try {
        // Use pool.execute for prepared statements with mysql2
        const [rows] = await pool.execute(
            'SELECT lecture_id, lecturer_name, lecturer_email FROM Lectures WHERE lecturer_email = ?', 
            [email]
        );

        if (rows.length > 0) {
            const lecturer = rows[0];
            const sessionId = crypto.randomUUID(); 
            sessions.set(sessionId, lecturer); // Store session data

            // Send back session ID and lecturer info
            return res.json({ 
                success: true, 
                message: 'Login successful', 
                sessionId: sessionId, 
                lecturer: lecturer 
            });
        } else {
            return res.status(401).json({ message: 'Lecturer not found.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error during login.' });
    }
});

/**
 * POST /api/logout - Clears the session
 */
app.post('/api/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
});


/**
 * GET /api/lecture/students - Retrieves all students for the current lecturer's lecture
 */
app.get('/api/lecture/students', authenticateLecturer, async (req, res) => {
    const { lecture_id } = req.lecturer;
    try {
        const [rows] = await pool.execute(
            'SELECT student_id, first_name, last_name, face_descriptor FROM Students WHERE lecture_id = ?',
            [lecture_id]
        );

        // MySQL's JSON type is usually handled automatically, but we ensure the 
        // face_descriptor is parsed in case it's returned as a string.
        const students = rows.map(row => ({
            ...row,
            // MySQL's JSON type is often returned as a string, so we parse it manually
            face_descriptor: row.face_descriptor ? JSON.parse(row.face_descriptor) : null
        }));

        res.json({ success: true, students });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Failed to retrieve students.' });
    }
});

/**
 * POST /api/lecture/student - Adds a new student with their face descriptor
 */
app.post('/api/lecture/student', authenticateLecturer, async (req, res) => {
    const { studentId, firstName, lastName, faceDescriptor } = req.body;
    const { lecture_id } = req.lecturer;
    
    // Ensure the descriptor is stringified for safe insertion into MySQL JSON column
    const descriptorString = JSON.stringify(faceDescriptor); 

    try {
        await pool.execute(
            'INSERT INTO Students (student_id, first_name, last_name, lecture_id, face_descriptor) VALUES (?, ?, ?, ?, ?)',
            [studentId, firstName, lastName, lecture_id, descriptorString]
        );

        // Fetch the updated list of students to return to the client
        const [updatedRows] = await pool.execute(
            'SELECT student_id, first_name, last_name, face_descriptor FROM Students WHERE lecture_id = ?',
            [lecture_id]
        );
        
        res.status(201).json({ 
            success: true, 
            message: `Student ${studentId} added.`,
            students: updatedRows 
        });
    } catch (error) {
        console.error('Error adding student:', error);
        // Check for duplicate entry error code (ER_DUP_ENTRY)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Student ID ${studentId} already exists.` });
        }
        res.status(500).json({ message: 'Failed to add student.' });
    }
});

/**
 * DELETE /api/lecture/student/:studentId - Removes a student and their attendance records
 */
app.delete('/api/lecture/student/:studentId', authenticateLecturer, async (req, res) => {
    const { studentId } = req.params;
    const { lecture_id } = req.lecturer;

    try {
        // Start a transaction for safety
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Delete related attendance records first due to Foreign Key constraint
            await connection.execute(
                'DELETE FROM AttendanceRecords WHERE student_id = ? AND lecture_id = ?',
                [studentId, lecture_id]
            );
            
            // 2. Then, delete the student
            const [deleteResult] = await connection.execute(
                'DELETE FROM Students WHERE student_id = ? AND lecture_id = ?',
                [studentId, lecture_id]
            );

            if (deleteResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Student not found or not in this lecture.' });
            }
            
            await connection.commit();

            // Fetch the remaining students to update the UI
            const [updatedRows] = await pool.execute(
                'SELECT student_id, first_name, last_name, face_descriptor FROM Students WHERE lecture_id = ?',
                [lecture_id]
            );

            res.json({ 
                success: true, 
                message: `Student ${studentId} removed.`,
                students: updatedRows 
            });

        } catch (innerError) {
            await connection.rollback();
            throw innerError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error removing student:', error);
        res.status(500).json({ message: 'Failed to remove student.' });
    }
});

/**
 * POST /api/attendance - Records an attendance check-in
 * Called when face recognition is successful on the student-facing page (index.html)
 */
app.post('/api/attendance', async (req, res) => {
    const { studentId, lectureId, imageDataUrl, latitude, longitude } = req.body;
    
    if (!studentId || !lectureId) {
        return res.status(400).json({ message: 'Missing student ID or lecture ID.' });
    }

    try {
        // Placeholder for storing image. In a real application, you would save 
        // imageDataUrl to an external cloud storage (like S3/GCS) and store the path.
        const imagePathPlaceholder = `images/${studentId}-${Date.now()}.png`;

        await pool.execute(
            // Use MySQL's NOW() for the DATETIME column
            'INSERT INTO AttendanceRecords (student_id, lecture_id, lecture_date, is_manual, image_path, latitude, longitude) VALUES (?, ?, CURDATE(), ?, ?, ?, ?)',
            [studentId, lectureId, false, imagePathPlaceholder, latitude, longitude]
        );
        
        res.status(201).json({ success: true, message: 'Attendance recorded successfully!' });
    } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).json({ message: 'Failed to record attendance.' });
    }
});


/**
 * GET /api/attendance/:lectureId - Retrieves today's attendance records
 * Called by index.html for the student-facing dashboard display
 */
app.get('/api/attendance/:lectureId', async (req, res) => {
    const { lectureId } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT 
                AR.student_id, 
                S.first_name, 
                S.last_name, 
                TIME_FORMAT(AR.check_in_time, '%H:%i:%s') AS check_in_time, 
                AR.latitude, 
                AR.longitude
             FROM AttendanceRecords AR
             JOIN Students S ON AR.student_id = S.student_id
             WHERE AR.lecture_id = ? AND AR.lecture_date = CURDATE()
             ORDER BY AR.check_in_time DESC`,
            [lectureId]
        );

        res.json({ success: true, attendance: rows });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ message: 'Failed to retrieve attendance records.' });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Ensure you run the mysql_schema.sql script on your MySQL database first.');
});
