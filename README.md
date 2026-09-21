# BagBill — Digital Billing & Business Record System

BagBill is a full-stack digital billing and business record management system designed for small wholesale and trading businesses such as bag suppliers and distributors.

It replaces manual paper bill-book calculations and handwritten transaction records with a centralized digital system for billing, customer management, product management, payments, GST tracking, reporting, and business records.

---

## Project Overview

Traditional wholesale businesses often depend on handwritten bills and physical calculation books to manage daily transactions. This can make calculations, payment tracking, customer ledgers, and historical records difficult to maintain.

BagBill provides a digital workflow for:

- Creating GST invoices
- Managing customers and party accounts
- Managing bag products and rates
- Tracking paid, partial, and pending payments
- Maintaining party ledgers
- Monitoring outstanding amounts
- Generating PDF invoices
- Tracking sales and GST
- Viewing business reports and analytics
- Maintaining business and invoice settings

---

## Key Features

### Digital Billing
- Create GST tax invoices
- Multiple bag/product items per invoice
- Quantity and rate calculation
- Discount calculation
- CGST, SGST and IGST support
- Round-off support
- Payment status management
- Partial payment and balance tracking
- Automatic invoice numbering
- Live invoice preview

### Smart Bag Calculator
- Calculate quantity × rate
- Apply discounts
- Calculate GST
- Automatically calculate the final payable amount
- Apply calculated values directly to the bill

### Bill Book
- Centralized digital invoice ledger
- Search by party, invoice number, or phone number
- Filter by payment status
- View invoice details
- Edit and duplicate bills
- Generate PDF invoices
- Print invoices
- Record payments

### Party Management
- Add and edit business parties
- Store phone, address and GSTIN
- View total purchases
- Track collected payments
- Track outstanding balances
- View complete party transaction history
- Party ledger based on recorded invoices

### Product Management
- Manage different bag types
- Store default rates
- GST rates
- HSN/SAC codes
- Stock quantities
- Units
- Product categories
- Archive products
- Add products directly to a bill

### Dashboard
- Today's sales
- Today's collection
- Today's outstanding amount
- Number of bills
- Bags sold
- Total sales
- Total paid
- Outstanding payments
- GST collected
- Sales trends
- Payment overview

### Reports & Analytics
- Sales over time
- Payment status analysis
- GST summary
- Taxable turnover
- Product-wise sales
- Party-wise sales
- Outstanding receivables
- Bill value distribution
- Top-selling products
- Top parties
- CSV and PDF export

### Business Settings
- Business profile
- Proprietor details
- Business address
- GSTIN and PAN
- Invoice settings
- Bank and payment details
- Tax settings
- Terms and conditions
- Invoice signature
- Application appearance settings

---

## Screenshots

### Dashboard

![Dashboard](./Screenshot%202026-09-21%20164714.png)

![Dashboard Analytics](./Screenshot%202026-09-21%20164731.png)

---

### Create Bill

![Create Bill](./Screenshot%202026-09-21%20164747.png)

![Taxation and Settlement](./Screenshot%202026-09-21%20164800.png)

![Bill Summary and Invoice Preview](./Screenshot%202026-09-21%20164809.png)

---

### Bill Book

![Digital Bill Book](./Screenshot%202026-09-21%20164822.png)

---

### Party Management

![Party Management](./Screenshot%202026-09-21%20164900.png)

---

### Product Management

![Product Management](./Screenshot%202026-09-21%20164911.png)

---

### Reports & Analytics

![Business Reports](./Screenshot%202026-09-21%20164930.png)

![GST and Business Analytics](./Screenshot%202026-09-21%20165003.png)

---

### Business Settings

![Business Settings](./Screenshot%202026-09-21%20165023.png)

---

## System Architecture

```text
                ┌─────────────────────────┐
                │      React Frontend     │
                │   TypeScript + Vite     │
                └────────────┬────────────┘
                             │
                             │ REST API
                             ▼
                ┌─────────────────────────┐
                │    Node.js + Express    │
                │       Backend API       │
                └────────────┬────────────┘
                             │
                             │ Mongoose
                             ▼
                ┌─────────────────────────┐
                │        MongoDB          │
                │   Persistent Database   │
                └─────────────────────────┘
Technology Stack
Frontend
React
TypeScript
Vite
Tailwind CSS
React Router
Recharts
Backend
Node.js
Express.js
Mongoose
REST APIs
CORS
dotenv
Database
MongoDB
Utilities
jsPDF
PDF generation
CSV export
Git & GitHub
Main API Modules

The backend is organized around the core business entities:

/api/bills
/api/parties
/api/products
/api/settings

These modules support the main billing and business-record workflows.

Core Billing Workflow
Select / Create Party
        ↓
Select Bag Product
        ↓
Enter Quantity & Rate
        ↓
Apply Discount
        ↓
Calculate GST
        ↓
Review Invoice
        ↓
Select Payment Status
        ↓
Save Bill
        ↓
Generate PDF / Print
        ↓
Bill Book & Party Ledger
        ↓
Dashboard & Reports
Data Management

BagBill maintains a single business workflow across:

Bills
Parties
Products
Payments
GST
Settings
Reports

This keeps invoice information, customer balances, payment records, and business analytics consistent across the application.

Invoice Management

Each invoice contains:

Invoice number
Bill date
Party information
GSTIN
Product details
Quantity
Rate
Discount
HSN/SAC
GST
Grand total
Payment status
Amount paid
Balance due
Bank/payment information
Terms and conditions
Signature section

Invoices can be previewed, printed, and exported as PDF documents.

Getting Started
1. Clone the repository
git clone https://github.com/rithii1702/BagBill.git
cd BagBill
2. Install frontend dependencies
npm install
3. Configure the backend
cd backend
npm install

Create the backend environment file from the provided example:

.env.example

Configure the required MongoDB connection and server settings in .env.

4. Start the backend
npm run dev
5. Start the frontend

Open another terminal in the project root:

npm run dev

The application can then be opened using the local Vite development URL shown in the terminal.

Project Structure
BagBill/
│
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── config/
│   └── server.js
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── utils/
│   └── ...
│
├── .env.example
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
Business Impact

BagBill is designed to help wholesale businesses move from manual record keeping to a structured digital workflow.

The system helps reduce:

Manual calculation errors
Duplicate invoice records
Lost paper records
Payment tracking difficulties
Repeated customer data entry
Difficulties in finding historical bills

It provides a centralized way to manage daily billing and business records.

Future Enhancements

Potential future improvements include:

User authentication and role-based access
Cloud deployment
Automated invoice sharing through WhatsApp/email
Advanced inventory management
Automated payment reminders
Multi-business support
Online backup and synchronization
Mobile-friendly PWA support
Project Status

BagBill is an actively developed full-stack digital billing and business record management project.

Current modules include:

Dashboard
Digital Bill Book
Create Bill
Smart Bag Calculator
Party Management
Product Management
Reports & Analytics
GST Tracking
PDF Invoice Generation
Business Settings
Node.js / Express Backend
MongoDB Database Integration
Author

B. Rithika Shree

BE — Artificial Intelligence & Machine Learning

RajaRajeswari College of Engineering


