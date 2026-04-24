# IT Asset Inventory Management System

A complete, production-ready IT Asset Inventory Management System built with a robust NestJS backend and a modern Angular 17+ frontend.

## 🚀 Technologies

### Backend
- **NestJS**: Scalable Node.js framework
- **TypeORM**: Modern ORM for TypeScript
- **PostgreSQL**: Relational database
- **Redis**: Caching and token blacklisting
- **MinIO**: S3-compatible object storage for asset images
- **Swagger**: API documentation (`/api/docs`)

### Frontend
- **Angular 17+**: Standalone components, signals, robust routing
- **NgRx**: State management (Store, Effects)
- **TailwindCSS**: Utility-first CSS framework
- **AG Grid**: High-performance data grids
- **Chart.js**: Dynamic dashboard visualizations
- **ZXing**: QR/Barcode scanner integration
- **Lucide Icons**: Beautiful, consistent icon set

## 🌟 Key Features

- **Authentication & RBAC**: Secure JWT-based login with roles (`admin`, `technician`, `employee`).
- **Asset Management**: Complete CRUD operations, lifecycle tracking, and assignments.
- **Master Data**: Manage Categories, Locations, and Users.
- **Dynamic Dashboard**: KPI cards and charts visualizing asset statuses and categories.
- **Barcode/QR Scanning**: Integrated webcam scanner for quick asset lookup and actions.
- **Image Uploads**: Direct integration with MinIO for storing asset photos.

---

## 🛠️ Local Setup Instructions

### Prerequisites
Make sure you have the following installed on your machine:
- Node.js (v18+)
- PostgreSQL
- Redis
- MinIO

### 1. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your local database, Redis, and MinIO credentials:
   ```bash
   cp .env.example .env
   ```
4. Run TypeORM migrations to set up the database schema:
   ```bash
   npm run migration:run
   ```
5. Start the backend server:
   ```bash
   npm run start:dev
   ```
   *The API will be available at `http://localhost:3000/api`*
   *Swagger Docs: `http://localhost:3000/api/docs`*

### 2. Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
   *(Note: `--legacy-peer-deps` is required due to some peer dependency mismatches with Angular 17 and AG Grid/Material)*
3. Start the Angular development server:
   ```bash
   npm start
   ```
   *The web app will be available at `http://localhost:4200`*

---

## 📝 Design Decisions

- **Standalone Components**: The frontend exclusively uses Angular 17 standalone components to reduce boilerplate and improve maintainability.
- **Token Blacklisting**: Redis is used to blacklist JWT tokens upon logout, ensuring absolute security for invalidated sessions.
- **S3 Compatibility**: MinIO is used over local file storage to ensure the system is cloud-ready. Switching to AWS S3 in production requires only configuration changes.
- **Tailwind + Inter**: Chosen for building a modern, clean, and highly responsive UI without the bloat of traditional component libraries.

## 🤝 Contribution

Contributions, issues, and feature requests are welcome. Feel free to check the issues page if you want to contribute.
