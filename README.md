# E-Commerce Backend API

Node.js + TypeScript + Prisma backend for e-commerce platform.

## Quick Start

```bash
# Clone & Install
git clone <your-repo>
cd backend
npm install

# Copy env
cp .env.example .env
# Update .env with DB credentials

# Run migrations
npx prisma migrate dev
npx prisma generate

# Start dev server
npm run dev
```

## API Endpoints

- check this [Postman collection](https://documenter.getpostman.com/view/12708391/2sBXVhBqG2) for more information

```bash
POST      /api/products                    # Create Single Product

PUT       /api/products                    # Update Single Product

GET       /api/products?page=1&limit=12    # Products (paginated)

GET       /api/products?page=2&limit=12    # Next page

GET       /api/products/3                  # Get Single Product

Delete    /api/products/3                  # Delete Single Products

GET       /api/orders                      # Orders (paginated + filters)

GET       /api/orders?name=John&page=1     # Filtered orders

POST      /api/orders                      # Create Single Order

Patch     /api/orders                      # Update Single Order Status workflow

GET       /api/orders/3                  # Get Single Orders

GET       /api/orders?page=1&limit=12    # Orders (paginated)

GET       /api/orders?page=2&limit=12    # Next page

Filters: name, email, mobileNumber, status, orderDateFrom, orderDateTo
Workflow: Pending -> Confirmed -> Shipped -> Delivered  || canceled
```

## Scripts

```bash
npm run dev     # Development (nodemon)
npm run build   # Production build
npm run start   # Production start
```

## Tech Stack

- Runtime: Node.js + TypeScript

- Framework: Express.js

- Database: Prisma ORM (PostgreSQL)

- Pagination: Server-side (filters supported)

## Environment Variables

- DATABASE_URL

- DIRECT_URL

- THIRD_PARTY_URL

- AUTH_TOKEN

- CLOUDINARY_CLOUD_NAME

- CLOUDINARY_API_KEY

- CLOUDINARY_API_SECRET

## Models

- Product (id, name, price, stockQty, description)

- SalesOrder (customerName, email, status, orderItems)

- OrderItem (product, quantity)
