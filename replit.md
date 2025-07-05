# BookShare - Digital Library Platform

## Overview

BookShare is a community-driven digital library platform that enables book sharing within residential societies. The application allows users to join societies, lend their books to earn money, and borrow books from other members. It features a comprehensive rental system with payment processing, barcode scanning for book identification, and a referral program.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints with JSON responses
- **Session Management**: Express sessions with HTTP-only cookies
- **File Structure**: Monorepo structure with shared types and schemas

### Database & ORM
- **Database**: PostgreSQL (configured via Neon serverless)
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle Kit for database migrations
- **Connection**: Neon serverless with WebSocket support

## Key Components

### Authentication System
- Session-based authentication using express-session
- User registration with email/password
- Profile management with Indian city selection
- Admin role system for platform management
- Password reset functionality (schema prepared)

### Society Management
- Society creation with approval workflow (90+ apartments requirement)
- Society joining via codes or direct membership
- Multi-society membership support
- Society statistics tracking (member count, book count, active rentals)

### Book Management
- Manual book entry with comprehensive metadata
- Barcode scanning capability (using @zxing/library)
- Book condition tracking (Very Good, Good, Fair, Poor)
- Daily rental fee setting by book owners
- Book availability status management

### Rental System
- Book borrowing with duration selection
- Payment calculation including platform commission (5%)
- Security deposit handling
- Rental tracking and history
- Due date management with overdue notifications

### Payment Integration
- Razorpay payment gateway integration
- Order creation and payment verification
- Commission-free periods for new users
- Earnings tracking for book lenders

### Referral Program
- Unique referral codes for each user
- Referral reward system
- Commission-free lending periods for successful referrals
- Referral statistics and tracking

## Data Flow

1. **User Registration**: User creates account → joins/creates society → can add books or browse available books
2. **Book Lending**: Owner adds book → sets daily fee → book becomes available for borrowing
3. **Book Borrowing**: Borrower searches books → selects book → calculates fees → processes payment → creates rental record
4. **Rental Management**: System tracks due dates → sends notifications → handles returns and renewals

## External Dependencies

### Payment Processing
- **Razorpay**: Payment gateway for handling transactions
- **Stripe**: Alternative payment provider (components prepared)

### Database & Hosting
- **Neon**: Serverless PostgreSQL hosting
- **Replit**: Development and deployment platform

### UI & Utilities
- **Radix UI**: Headless UI components
- **Tailwind CSS**: Utility-first CSS framework
- **React Hook Form**: Form handling with validation
- **Zod**: Schema validation library

### Media & Scanning
- **@zxing/library**: Barcode scanning functionality
- **Camera API**: Device camera access for barcode scanning

## Deployment Strategy

### Development
- **Environment**: Node.js 20 with Replit development environment
- **Hot Reload**: Vite development server with HMR
- **Database**: PostgreSQL 16 module in Replit

### Production
- **Build Process**: Vite for client build, esbuild for server bundling
- **Deployment Target**: Replit autoscale deployment
- **Port Configuration**: Internal port 5000, external port 80
- **Environment Variables**: DATABASE_URL, SESSION_SECRET

### Database Management
- **Schema Management**: Drizzle ORM with TypeScript schemas
- **Migrations**: Automated via `npm run db:push` command
- **Connection Pooling**: Neon serverless connection pooling

## Recent Changes

```
- June 22, 2025: Fixed app startup errors and database connection issues
- June 22, 2025: Switched to memory storage to resolve Neon database endpoint issues
- June 22, 2025: Fixed logout redirect to properly clear session and return to welcome page
- June 22, 2025: Fixed profile picture upload to work with memory storage
- June 22, 2025: Added user account with email "jia.a.maheshwari@gmail.com" and password "bossbaby@12"
- July 5, 2025: Added admin account with email "abhinic@gmail.com" and password "admin123" with full admin privileges
- June 22, 2025: Fixed books data handling in enhanced-browse page to prevent array errors
```

## Changelog

```
Changelog:
- June 15, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```