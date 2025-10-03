const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static('public'));

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'attendance_app',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;
try {
    pool = mysql.createPool(dbConfig);
    console.log("MySQL pool created successfully.");
    
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("❌ Database connection failed:", err.message);
            console.log("💡 Please check your database configuration in config.js");
            console.log("💡 Make sure MySQL is running and the database 'attendance_app' exists");
        } else {
            console.log("✅ Database connection successful!");
            connection.release();
        }
    });
} catch (error) {
    console.error("❌ Failed to create MySQL pool:", error);
    console.log("💡 Please check your database configuration");
    process.exit(1);
}

const sessions = new Map();

function authenticateLecturer(req, res, next) {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ message: 'Unauthorized: Please log in.' });
    }
    req.lecturer = sessions.get(sessionId);
    next();
}

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    const HARDCODED_PASSWORD = 'Noluthando@1';

    if (password !== HARDCODED_PASSWORD) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT lecture_id, lecturer_name, lecturer_email FROM Lectures WHERE lecturer_email = ?', 
            [email]
        );

        if (rows.length > 0) {
            const lecturer = rows[0];
            const sessionId = crypto.randomUUID();
            sessions.set(sessionId, lecturer);

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

app.post('/api/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/lecture/students', async (req, res) => {
    const lecture_id = 'CS101_L1';
    
    try {
        const [rows] = await pool.execute(
            'SELECT student_id, first_name, last_name, face_descriptor, profile_image, image_type, created_at FROM Students WHERE lecture_id = ?',
            [lecture_id]
        );

        const students = rows.map(row => ({
            ...row,
            face_descriptor: row.face_descriptor ? JSON.parse(row.face_descriptor) : null
        }));

        res.json({ success: true, students });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Failed to retrieve students.' });
    }
});

app.post('/api/lecture/student', async (req, res) => {
    const { studentId, firstName, lastName, faceDescriptor, profileImage } = req.body;
    
    const lecture_id = 'CS101_L1';
    
    if (!studentId || !firstName || !lastName || !faceDescriptor || !profileImage) {
        return res.status(400).json({ message: 'Missing required fields: studentId, firstName, lastName, faceDescriptor, profileImage' });
    }
    
    const descriptorString = JSON.stringify(faceDescriptor);

    try {
        await pool.execute(
            'INSERT INTO Students (student_id, first_name, last_name, lecture_id, face_descriptor, profile_image, image_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [studentId, firstName, lastName, lecture_id, descriptorString, profileImage, 'base64']
        );

        const [updatedRows] = await pool.execute(
            'SELECT student_id, first_name, last_name, face_descriptor, profile_image FROM Students WHERE lecture_id = ?',
            [lecture_id]
        );
        
        res.status(201).json({ 
            success: true, 
            message: `Student ${studentId} added successfully with image.`,
            students: updatedRows 
        });
    } catch (error) {
        console.error('Error adding student:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Student ID ${studentId} already exists.` });
        }
        res.status(500).json({ message: 'Failed to add student.' });
    }
});

app.delete('/api/lecture/student/:studentId', authenticateLecturer, async (req, res) => {
    const { studentId } = req.params;
    const { lecture_id } = req.lecturer;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            await connection.execute(
                'DELETE FROM AttendanceRecords WHERE student_id = ? AND lecture_id = ?',
                [studentId, lecture_id]
            );
            
            const [deleteResult] = await connection.execute(
                'DELETE FROM Students WHERE student_id = ? AND lecture_id = ?',
                [studentId, lecture_id]
            );

            if (deleteResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Student not found or not in this lecture.' });
            }
            
            await connection.commit();

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

app.post('/api/attendance', async (req, res) => {
    const { studentId, lectureId, imageDataUrl, latitude, longitude } = req.body;
    
    if (!studentId || !lectureId) {
        return res.status(400).json({ message: 'Missing student ID or lecture ID.' });
    }

    try {
        await pool.execute(
            'INSERT INTO AttendanceRecords (student_id, lecture_id, lecture_date, is_manual, check_in_image, image_type, latitude, longitude) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)',
            [studentId, lectureId, false, imageDataUrl, 'base64', latitude, longitude]
        );
        
        res.status(201).json({ success: true, message: 'Attendance recorded successfully with image!' });
    } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).json({ message: 'Failed to record attendance.' });
    }
});

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
                AR.longitude,
                AR.check_in_image,
                AR.image_type
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Ensure you run the mysql_schema.sql script on your MySQL database first.');
});