import mysql.connector
from config import Config

def get_db():
    """Get a MySQL database connection."""
    return mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB,
    )

def init_db():
    """Create tables if they don't exist and seed default admin."""
    conn = mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
    )
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {Config.MYSQL_DB}")
    conn.close()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'doctor', 'patient') NOT NULL DEFAULT 'patient',
            full_name VARCHAR(200) NOT NULL,
            phone VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            name VARCHAR(200) NOT NULL,
            age INT NOT NULL,
            gender ENUM('Male', 'Female') NOT NULL,
            diabetes_type ENUM('Type 1', 'Type 2', 'Gestational') NOT NULL,
            phone VARCHAR(20),
            email VARCHAR(255),
            blood_sugar DECIMAL(6,2) DEFAULT 0,
            hba1c DECIMAL(4,2) DEFAULT 0,
            adherence_rate DECIMAL(5,2) DEFAULT 0,
            status ENUM('stable', 'warning', 'critical') DEFAULT 'stable',
            last_visit DATE,
            next_visit DATE,
            assigned_doctor_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (assigned_doctor_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS medications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            name VARCHAR(200) NOT NULL,
            dosage VARCHAR(100) NOT NULL,
            frequency VARCHAR(100) NOT NULL,
            time VARCHAR(100),
            taken BOOLEAN DEFAULT FALSE,
            refill_date DATE,
            prescribed_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (prescribed_by) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            doctor_id INT,
            appointment_date DATETIME NOT NULL,
            type VARCHAR(100) DEFAULT 'Follow-up',
            status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # Seed default admin user (password: admin123)
    import bcrypt
    password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        cursor.execute("""
            INSERT INTO users (username, email, password_hash, role, full_name)
            VALUES ('admin', 'admin@diabecare.com', %s, 'admin', 'System Administrator')
        """, (password_hash,))
        conn.commit()
        print("Default admin user created (admin / admin123)")
    except mysql.connector.IntegrityError:
        pass  # Admin already exists

    conn.commit()
    cursor.close()
    conn.close()
    print("Database initialized successfully.")
