# Face Gaze Attendance System

A face recognition-based attendance system built with Node.js, Express, MySQL, and face-api.js.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- Modern web browser with camera support

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   - Create a MySQL database named `attendance_app`
   - Run the SQL script: `attendence.sql`
   ```sql
   mysql -u root -p attendance_app < attendence.sql
   ```

3. **Configure Database**
   - Copy `config.example.js` to `config.js`
   - Update database credentials in `config.js`

4. **Start the Application**
   ```bash
   npm start
   ```

5. **Access the Application**
   - Open your browser to `http://localhost:3000`
   - Use the lecturer login: `ntuthukolwandisa@gmail.com` / `Noluthando@1`

## 📁 Project Structure

```
Face Gaze/
├── index.html          # Student attendance page
├── lecture.html        # Lecturer dashboard
├── server.js           # Backend API server
├── attendence.sql      # Database schema
├── package.json        # Dependencies
└── config.example.js   # Database configuration template
```

## 🔧 Configuration

### Database Configuration
Update `config.js` with your MySQL credentials:
```javascript
module.exports = {
    database: {
        host: 'localhost',
        user: 'your_username',
        password: 'your_password',
        database: 'attendance_app',
        port: 3306
    }
};
```

### Environment Variables (Optional)
You can also use environment variables:
```bash
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=attendance_app
export DB_PORT=3306
```

## 🎯 Features

- **Student Check-in**: Face recognition-based attendance
- **Lecturer Dashboard**: Manage students and view attendance
- **Real-time Location**: GPS tracking for attendance
- **Manual Check-in**: Fallback option for students
- **Responsive Design**: Works on desktop and mobile

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify MySQL is running
   - Check database credentials in `config.js`
   - Ensure database `attendance_app` exists

2. **Camera Not Working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Try different browser

3. **Face Recognition Not Working**
   - Check internet connection (loads models from CDN)
   - Ensure good lighting
   - Try refreshing the page

### Error Messages

- `Camera access denied`: Grant camera permissions in browser
- `Database connection failed`: Check MySQL configuration
- `Face not detected`: Ensure face is clearly visible in camera

## 📝 API Endpoints

- `POST /api/login` - Lecturer authentication
- `GET /api/lecture/students` - Get enrolled students
- `POST /api/lecture/student` - Add new student
- `DELETE /api/lecture/student/:id` - Remove student
- `POST /api/attendance` - Record attendance
- `GET /api/attendance/:lectureId` - Get attendance records

## 🔒 Security Notes

- Change default lecturer credentials in production
- Use HTTPS in production
- Implement proper session management
- Hash passwords with bcrypt
- Validate all inputs

## 📱 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
