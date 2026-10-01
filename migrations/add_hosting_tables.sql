-- =======================================================
-- MIGRATION: ADD HOSTING & SUBSCRIPTION TABLES
-- Target Platform: PostgreSQL (Neon Database)
-- =======================================================

-- 1. HOSTING PLANS (Package catalog)
CREATE TABLE IF NOT EXISTS hosting_plans (
    id SERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    disk_space_mb INTEGER DEFAULT 10240,
    bandwidth_mb INTEGER DEFAULT 102400,
    price_monthly DECIMAL(15,2) DEFAULT 0.00,
    price_yearly DECIMAL(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CUSTOMER SUBSCRIPTIONS (Hosting rentals & recurring services)
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER, -- Link to contact/client
    plan_id INTEGER REFERENCES hosting_plans(id),
    domain_name VARCHAR(255) NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly'
    price DECIMAL(15,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'active', -- 'trial', 'active', 'due_soon', 'suspended', 'terminated', 'cancelled'
    start_date DATE NOT NULL,
    renewal_date DATE NOT NULL,
    server_ip VARCHAR(50),
    control_panel_username VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON customer_subscriptions(renewal_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_domain ON customer_subscriptions(domain_name);
