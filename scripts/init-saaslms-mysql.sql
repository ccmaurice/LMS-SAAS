-- Optional: bare-metal MySQL/MariaDB (Docker Compose creates DB + user automatically).
-- mysql -u root -p < scripts/init-saaslms-mysql.sql

CREATE DATABASE IF NOT EXISTS saaslms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'saaslms'@'localhost' IDENTIFIED BY 'saaslms';
CREATE USER IF NOT EXISTS 'saaslms'@'%' IDENTIFIED BY 'saaslms';
GRANT ALL PRIVILEGES ON saaslms.* TO 'saaslms'@'localhost';
GRANT ALL PRIVILEGES ON saaslms.* TO 'saaslms'@'%';
FLUSH PRIVILEGES;
