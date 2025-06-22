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
- June 22, 2025: Original data loss confirmed - Neon PostgreSQL endpoint permanently disabled
- June 22, 2025: Investigation completed - original user data cannot be recovered
- June 22, 2025: Attempted database restoration failed (endpoint error: "Control plane request failed: endpoint is disabled")
- June 22, 2025: Confirmed memory storage with recreated accounts: Jia Maheshwari and Abhinic Kumar
- June 22, 2025: 8 sample books available across both accounts (3 for Jia, 5 for Abhinic)
- June 22, 2025: All core functionality working with temporary memory storage
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