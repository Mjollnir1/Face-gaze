USE attendance_app;
ALTER TABLE Students 
ADD COLUMN profile_image LONGTEXT AFTER face_descriptor,
ADD COLUMN image_type VARCHAR(20) DEFAULT 'base64' AFTER profile_image,
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER image_type;

ALTER TABLE AttendanceRecords 
ADD COLUMN check_in_image LONGTEXT AFTER is_manual,
ADD COLUMN image_type VARCHAR(20) DEFAULT 'base64' AFTER check_in_image;

UPDATE Students SET image_type = 'base64' WHERE image_type IS NULL;
UPDATE AttendanceRecords SET image_type = 'base64' WHERE image_type IS NULL;

DESCRIBE Students;
DESCRIBE AttendanceRecords;
SELECT 'Migration completed successfully!' as status;
