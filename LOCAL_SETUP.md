# Local Environment Setup Guide

Follow these steps to set up the AssetAlloc system on your local machine.

## Prerequisites
- **Node.js**: Version 18 or higher
- **PostgreSQL**: A running instance of PostgreSQL
- **Git**: To clone the repository

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <your-repo-url>
   cd asset-alloc
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your PostgreSQL connection string:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/asset_alloc
   ```

4. **Initialize Database**
   Push the schema to your local database:
   ```bash
   npm run db:push
   ```

5. **Start the Application**
   Run the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5000`.

## Default Credentials
- **Admin**: `admin@lightmf.com`
- **Password**: `Admin@123`
