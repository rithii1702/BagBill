# BagBill — Digital Billing & Business Record System

BagBill is a full-stack digital billing and business record management system specifically designed for small wholesale and trading businesses (such as gunny, jute, HDPE, and commercial bag suppliers). It replaces manual paper bill-book calculations and ledger entries with an intuitive, reliable, and centralized digital system.

---

## 1. Project Overview

In traditional wholesale and trading operations, day-to-day transactions are often recorded on handwritten carbon-copy bill books. BagBill bridges the gap between traditional manual practices and modern digital record-keeping. The application automates invoice calculation, tracks customer payments (Paid, Partial, Pending), maintains a synchronized party ledger, tracks product stock, and provides real-time sales and GST analytics—all backed by a persistent MongoDB database.

---

## 2. Problem Statement

Handwritten billing and physical record-keeping introduce several common operational bottlenecks for trading enterprises:

- **Manual Calculations**: Calculating line-item prices, percentage discounts, round-offs, and CGST/SGST/IGST by hand is prone to human mathematical errors.
- **Difficult Transaction Tracking**: Reviewing transaction history requires manually flipping through stacks of physical paper bill books.
- **Risk of Misplaced Records**: Paper slips, loose receipt memos, and carbon copies can tear, fade, or get misplaced over time.
- **Difficult Outstanding/Payment Tracking**: Tracking credit balances and partial payments across multiple buyers is tedious and often causes delayed collections.
- **No Centralized Reporting**: Business owners lack instant access to daily, monthly, or annual turnover figures, GST collection breakdowns, or stock levels.

---

## 3. Key Features

- **Create and Manage GST Invoices**: Issue comprehensive tax invoices with customer details, itemized goods, tax modes, and banking details.
- **Smart Bill Calculator**: Real-time line-item calculation for quantity, unit rate, discount percentage, and GST rates, with automatic round-off adjustments.
- **Multiple Products / Bag Types**: Support for diverse bag categories (Gunny, HDPE, PP, Jute, Plastic, and Custom) within a single bill.
- **Automatic Calculations**: Dynamic computation of subtotals, item discounts, taxable values, CGST, SGST, IGST, and grand totals.
- **Payment Tracking**: Record advance payments during bill generation and post-settlement payments (Cash, UPI, Bank Transfer, Cheque) with full payment receipt histories (Paid, Partial, Pending).
- **Automatic Sequential Invoice Numbering**: Automated sequence generation with collision prevention and custom prefix/padding options.
- **Bill Book with Search & Filters**: Search bills by invoice number, customer name, or item description; filter by date range or payment status; and interactively sort by Date, Customer, or Amount.
- **Party Management & Party Ledger**: Customer directory maintaining contact details, GSTIN, billing addresses, transaction histories, and real-time outstanding balances.
- **Product Catalogue**: Central catalog with default rates, GST tax rates, HSN/SAC codes, stock tracking, and low-stock warnings.
- **Dashboard with Business KPIs**: Instant overview of Total Sales, Total Paid, Outstanding Dues, Total GST Collected, Bags Sold, and Average Bill Value.
- **Reports & Sales Analytics**: Detailed turnover trends, monthly performance charts, payment status distributions, and exportable reports.
- **GST Summary**: Clear separation of taxable revenue and tax totals (CGST, SGST, and IGST) for accounting compliance.
- **Outstanding Payment Tracking**: Dedicated views to quickly identify overdue receivables and log payment receipts against pending invoices.
- **PDF Invoice Generation**: Professional, print-ready PDF invoices styled with embedded TrueType fonts, Indian Rupee (₹) symbol support, and business profile snapshots.
- **Print Invoices**: Native browser-friendly print layout with dedicated `@media print` styling.
- **Business & Invoice Settings**: Customizable firm profile, GSTIN, PAN, bank account details, payment terms, and invoice formatting preferences.
- **Persistent MongoDB Storage**: Persistent MongoDB storage for bills, parties, catalog products, and settings via Mongoose schemas.
- **Duplicate-Bill Protection**: Rapid double-submission protection and unique invoice number constraints to prevent duplicate entries.

---

## 4. Tech Stack

### Frontend
- **React 19**: Modern UI library utilizing functional components and hooks.
- **TypeScript**: Static typing for data structures, API responses, and invoice models.
- **Vite**: Next-generation frontend build tooling and dev server.
- **Tailwind CSS**: Utility-first CSS styling tailored to a clean Kraft-paper design aesthetic.
- **Recharts**: Data visualization library for analytics and dashboard charts.
- **Lucide React**: Clean, lightweight iconography.

### Backend
- **Node.js**: Asynchronous JavaScript runtime environment.
- **Express.js**: REST API routing, request validation, and middleware architecture.
- **MongoDB**: NoSQL document database for flexible, persistent business records.
- **Mongoose**: Object Data Modeling (ODM) library for schema validation and aggregations.

### Additional Tools & Libraries
- **REST APIs**: Standard JSON HTTP communication between frontend and backend.
- **jsPDF**: Client-side vector PDF generation with custom TrueType font support.
- **Git & GitHub**: Version control and codebase management.

---

## 5. System Architecture

```text
React + TypeScript Frontend
        ↓
Express.js REST API
        ↓
MongoDB Database
```

- The **React Frontend** communicates with the Express backend through a centralized API service layer (`src/services/api.ts`).
- The **Express REST API** (`backend/server.js`) validates incoming payloads, executes business logic, prevents race-condition duplicates, and updates product stock atomically upon bill save.
- **MongoDB** stores all persistent collections (`bills`, `parties`, `products`, `settings`) ensuring zero reliance on ephemeral client storage.

---

## 6. Main Modules

- **Dashboard**: High-level executive view presenting key metrics (Turnover, Paid Amount, Receivables, Bags Sold), sales trends, top-selling bag types, and recent transactions.
- **Create Bill**: Core invoice generation workflow equipped with party auto-completion, bag preset quick-fill buttons, an inline bag calculator, live stock warnings, and payment settlement options.
- **Bill Book**: Searchable, filterable, and sortable historical archive of all generated invoices with action triggers to view, print, download PDF, duplicate, or record late payments.
- **Parties**: Central customer database providing contact information, GSTINs, aggregate purchase metrics, outstanding balances, and individualized transaction ledgers.
- **Products**: Product catalog managing bag types, unit rates, stock quantities, low-stock warnings, and HSN/SAC codes.
- **Reports**: Analytical hub containing sales summaries, GST tax collection breakups, party-wise turnover distributions, and periodic performance trends.
- **Settings**: Business configuration center managing enterprise identity (name, address, GSTIN, logo), banking/UPI details, default tax modes, invoice sequencing, and standard terms.

---

## 7. Invoice Workflow

```text
Select Party → Add Products → Calculate Quantity × Rate → Apply Discount/GST → Record Payment → Generate Invoice → Save to MongoDB → View in Bill Book/Party Ledger/Reports
```

1. **Select Party**: Choose an existing customer from the searchable database or create a new party inline.
2. **Add Products**: Add line items by selecting standard catalog bags or entering custom bag specifications.
3. **Calculate Quantity × Rate**: The calculator computes raw line-item totals based on entered quantities and prices.
4. **Apply Discount / GST**: Item discounts are subtracted to determine taxable amount, followed by CGST/SGST or IGST tax calculations.
5. **Record Payment**: Specify advance payment amounts received at billing time (Paid, Partial, or Pending).
6. **Generate Invoice**: Automatic assignment of the next sequential invoice number with a snapshot of current company and bank details.
7. **Save to MongoDB**: The bill document is persisted in the database, and product stock is atomically decremented.
8. **View & Track**: The saved invoice immediately updates the Bill Book, adjusts the Party Ledger, recalculates Dashboard KPIs, and reflects in Reports.

---

## 8. Data Persistence

BagBill stores all primary business data directly in MongoDB via Mongoose models:
- **Bills Collection**: Complete invoice records with line items, tax breakdowns, payments array, and immutable company profile snapshots.
- **Parties Collection**: Customer records with contact details, GSTIN, addresses, and timestamps.
- **Products Collection**: Catalog items with pricing, HSN codes, and stock quantities.
- **Settings Collection**: Master business settings, invoice sequencing, and bank details.

Browser storage (`localStorage`) is used exclusively as an initial client-side cache for instantaneous UI rendering on launch; all business operations mutate and verify against the MongoDB database first.

---

## 9. Testing & Quality Assurance

The application has undergone structured quality assurance and verification:

- **End-to-End Integration Verification**: Automated test suites verified complete data flows across bill creation, payment recording, stock decrement, bill deletion, and stock restoration.
- **Validation & Error Handling**: Verified server-side validation rejecting invalid payloads (missing party names, empty item lists) with clean HTTP 400 responses.
- **Duplicate Bill Prevention**: Verified rapid duplicate submission suppression (within 5 seconds) and database-level unique index enforcement on invoice numbers.
- **Frontend / Proxy Checks**: Verified Vite proxy forwarding `/api` calls directly to the Express backend without CORS issues.
- **Production Build**: Clean production build compilation (`tsc -b && vite build`) with zero TypeScript errors.
- **Linter Verification**: Codebase passes linter checks (`oxlint`) with zero errors.
- **Persistence Verification**: Verified that all created bills, parties, payments, and settings persist accurately across page reloads and browser sessions.

---

## 10. Project Structure

```text
bagbill/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── billController.js
│   │   ├── dashboardController.js
│   │   ├── partyController.js
│   │   ├── productController.js
│   │   └── settingsController.js
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── Bill.js
│   │   ├── Party.js
│   │   ├── Product.js
│   │   └── Settings.js
│   ├── routes/
│   │   ├── bills.js
│   │   ├── dashboard.js
│   │   ├── parties.js
│   │   ├── products.js
│   │   └── settings.js
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── seed.js
│   └── server.js
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── calculator/
│   │   ├── common/
│   │   ├── invoice/
│   │   └── layout/
│   ├── context/
│   │   └── BagBillContext.tsx
│   ├── data/
│   │   └── seedData.ts
│   ├── pages/
│   │   ├── BillBook.tsx
│   │   ├── CreateBill.tsx
│   │   ├── Dashboard.tsx
│   │   ├── PartiesPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── analytics.ts
│       ├── formatters.ts
│       ├── numberToWords.ts
│       ├── pdfFonts.ts
│       └── pdfGenerator.ts
├── .env.example
├── .gitignore
├── .oxlintrc.json
├── index.html
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 11. Local Setup

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)
- **MongoDB** (v6 or higher running locally or a MongoDB Atlas URI)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd bagbill
```

### 2. Frontend Dependencies Installation
```bash
npm install
```

### 3. Backend Setup & Configuration
Open a terminal and navigate to the `backend` folder:
```bash
cd backend
npm install
```

Create your backend environment configuration file:
```bash
cp .env.example .env
```
*(On Windows PowerShell, run: `Copy-Item .env.example .env`)*

Verify that the local MongoDB daemon is running, then start the backend API:
```bash
npm start
```
*(For development with auto-restart, run: `npm run dev`)*

The backend server will start on `http://localhost:5000` and automatically connect to MongoDB.

### 4. Start the Frontend
In a separate terminal, return to the project root and run:
```bash
npm run dev
```

The frontend application will start on `http://localhost:5173` with the Vite proxy automatically routing `/api` requests to port 5000.

---

## 12. Environment Variables

Sensitive configuration values and database credentials must be managed using `.env` files and should never be committed to version control. Reference [`.env.example`](file:///.env.example) and [`backend/.env.example`](file:///backend/.env.example) as configuration templates:

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | Port number for the Express backend API server | `5000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/bagbill` |
| `CLIENT_URL` | Allowed frontend client origin for CORS policies | `http://localhost:5173` |
| `NODE_ENV` | Application runtime environment (`development` or `production`) | `production` |

---

## 13. Future Enhancements

- **Cloud Deployment**: Containerization with Docker and deployment onto scalable cloud platforms (e.g., AWS, Render, Vercel).
- **Authentication & Role-Based Access**: Multi-user support with owner, accountant, and sales representative access tiers.
- **Automated Backups**: Scheduled automated MongoDB database dumps to secure cloud storage.
- **Advanced Inventory Management**: Purchase order tracking, supplier management, and batch number tracking.
- **Online Invoice Sharing**: Direct invoice dispatch to buyers via WhatsApp Business API and email.

---

## 14. Project Purpose

BagBill was developed to demonstrate a practical full-stack business application that integrates modern frontend engineering, REST API architecture, database persistence, billing logic, and business analytics to solve real-world commerce challenges.
