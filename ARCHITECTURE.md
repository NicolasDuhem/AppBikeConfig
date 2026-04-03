# AppBikeConfig – Architecture & System Overview

## 1. Purpose

AppBikeConfig is a SKU configuration and availability management tool for Brompton bikes.

It allows:
- Defining SKU structure (30-digit logic)
- Building bike configurations
- Generating SKU combinations
- Managing availability matrix by country
- Controlling access via role-based permissions (RBAC)

The tool is designed to:
- Be used internally
- Feed downstream systems (e.g. B2B storefront)

---

## 2. Tech Stack

### Frontend / Backend
- Next.js 14 (App Router)
- React 18

### Database
- Neon (PostgreSQL serverless)

### Auth
- NextAuth (Credentials provider)
- JWT session strategy

### Hosting
- Vercel

---

## 3. Core Concepts

### 3.1 SKU Structure
- SKU = 30-digit string
- Each digit has:
  - Position (1–30)
  - Meaning (option)
  - Value mapping

Defined in:
- `sku_rules`

---

### 3.2 Bike Builder Flow

1. User selects options (handlebar, speed, etc.)
2. System generates all SKU combinations
3. User selects valid SKUs
4. User pushes SKUs to matrix

---

### 3.3 Matrix

Represents:
- SKU availability per country

Supports:
- Single update
- Bulk update
- Read filtering

---

## 4. Database Schema

### 4.1 Core Tables

#### `countries`
```sql
id
code (UK, FR, etc.)
name
products_matrix
id
sku
bike_type
country_code
is_active
created_at
updated_at
sku_rules
id
digit_position
option_key
option_value
label
setup_options
id
option_key (handlebar, speed, etc.)
option_value
label
5. Authentication & RBAC
5.1 Tables
app_users
id
email
password_hash
is_active
created_at
roles
id
role_key

Seeded roles:

sys_admin
sales_admin
sales_standard
product_admin
read_only
user_roles
user_id
role_id
audit_log
id
user_id
action
entity
entity_id
payload
created_at
5.2 Roles & Permissions
Role	Capabilities
sys_admin	Full access + user management
sales_admin	Bulk matrix updates + country management
sales_standard	Single updates only
product_admin	SKU builder + push to matrix
read_only	View only
5.3 Permission Model

Defined in:

lib/rbac.ts

Example:

can(roles, 'matrix.bulk_update')
6. Authentication Flow
Login
Email + password
Password stored as bcrypt hash
Verified via NextAuth Credentials provider
Session
JWT-based
userId stored in token
Helpers
getCurrentSession()
getCurrentUser()
getCurrentUserRoles()
requireLogin()
requireRole(action)
7. API Structure
Auth
/api/auth/[...nextauth]
User / RBAC
GET  /api/me
GET  /api/users
POST /api/users
PATCH /api/users
GET  /api/roles
Matrix
POST /api/matrix
POST /api/matrix/bulk-update
Setup
POST /api/setup-options
SKU Rules
POST /api/sku-rules
Builder
POST /api/builder-push
Countries
POST /api/countries
8. UI Pages
Page	Purpose
/login	Authentication
/matrix	SKU availability
/setup	Option setup
/sku-definition	SKU structure
/bike-builder	Generate SKUs
/users	Admin user management
9. Security Model
Server-side enforcement

ALL write APIs enforce:

requireRole(action)
UI enforcement

UI uses:

/api/me

to:

hide buttons
disable actions

⚠️ UI is NOT security — backend is source of truth.

10. Environment Variables
Required
DATABASE_URL=postgres connection string (Neon)
AUTH_SECRET=random secure string

Recommended:

NEXTAUTH_SECRET (same as AUTH_SECRET)
11. Local Development
npm install
npm run dev
Database setup

Run:

sql/schema.sql
sql/seed.sql (optional)
sql/002_auth_rbac.sql
12. Deployment
Flow
Push to GitHub
Vercel auto-deploys
Uses environment variables set in Vercel
Important
.env.local must NOT be committed
Secrets live in Vercel only
13. Future Improvements
Short term
Proper error handling UI
Pagination for matrix
Search/filter improvements
Mid term
Replace credentials auth with SSO (Azure AD)
Add audit UI
Add export/import (CSV)
Long term
Move to full API backend (if scaling)
Integrate with B2B storefront
Introduce caching layer
14. Codex Instructions

When modifying this repo:

Always respect:
RBAC (requireRole)
Audit logging
DB schema consistency
Never:
Bypass backend authorization
Store secrets in frontend
When adding features:
Add DB schema if needed
Add API route
Protect with RBAC
Log in audit_log
Update UI
Update this file
15. Mental Model

This app is:

A configuration engine
A controlled data entry system
A permissioned internal platform
A future data source for commerce
16. Ownership

Owned by:

IT Systems / Product team

Used by:

Sales
Product
Operations
