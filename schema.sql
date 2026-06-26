-- PostgreSQL Schema for Internal System

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  name VARCHAR(255),
  permissions TEXT,
  is_superadmin BOOLEAN DEFAULT FALSE,
  is_disabled BOOLEAN DEFAULT FALSE,
  ip_whitelist TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  content TEXT,
  feedback_from_customer TEXT,
  last_update DATE,
  status VARCHAR(100),
  completed_date DATE,
  pro_account VARCHAR(10),
  sale_owner VARCHAR(255),
  sale_updated TEXT,
  other TEXT,
  pipeline_stage VARCHAR(100),
  priority VARCHAR(50),
  next_follow_up_date DATE,
  tags TEXT,
  status_in_production VARCHAR(100),
  date_to_production DATE,
  date_have_traffic DATE,
  is_imported BOOLEAN DEFAULT FALSE,
  stage_updated_at TIMESTAMP,
  custom_data TEXT,
  create_date DATE,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  action VARCHAR(100),
  entity VARCHAR(100),
  entityId VARCHAR(255),
  details TEXT,
  userId INTEGER,
  userName VARCHAR(255),
  timestamp TIMESTAMP,
  ip_address VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id SERIAL PRIMARY KEY,
  time TIMESTAMP,
  content TEXT,
  phone_number VARCHAR(50),
  message_id VARCHAR(255),
  sms_parts INTEGER,
  sender VARCHAR(100),
  route VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  ip VARCHAR(100) PRIMARY KEY,
  blocked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  ip VARCHAR(100),
  timestamp TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS column_settings (
  id SERIAL PRIMARY KEY,
  pipeline_stage VARCHAR(100) UNIQUE,
  columns_json TEXT
);

CREATE TABLE IF NOT EXISTS support_reports (
  id SERIAL PRIMARY KEY,
  date DATE,
  task TEXT,
  time VARCHAR(100),
  result TEXT,
  type VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS task_reports (
  id SERIAL PRIMARY KEY,
  task_assign TEXT,
  time VARCHAR(100),
  result TEXT,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS internal_reports (
  id SERIAL PRIMARY KEY,
  date DATE,
  action_tasks TEXT,
  result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kpi_records (
  id SERIAL PRIMARY KEY,
  create_date DATE,
  company VARCHAR(255),
  contact_name VARCHAR(255),
  contact_by VARCHAR(255),
  problem TEXT,
  problem_type VARCHAR(100),
  response_time VARCHAR(100),
  resolve_time VARCHAR(100),
  solution TEXT,
  resolved_same_day VARCHAR(10),
  deleted_at TIMESTAMP
);
