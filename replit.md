# BookPotato - Digital Library Platform

## Overview

BookPotato (formerly BorrowBooks and BookShare) is a community-driven digital library platform facilitating book sharing within residential societies. It enables users to lend and borrow books, manage rentals with payment processing, utilize barcode scanning for book identification, and participate in a referral program. The platform aims to create a comprehensive rental system, offering a new way for community members to share resources and earn through their book collections.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with custom CSS variables
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON
- **Session Management**: Express sessions with HTTP-only cookies
- **File Structure**: Monorepo

### Database & ORM
- **Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit

### Key Features
- **Authentication**: Session-based, user registration, profile management, admin roles, password reset.
- **Society Management**: Creation (with approval), joining, multi-society support, statistics tracking.
- **Book Management**: Manual entry, barcode scanning, condition tracking, daily rental fees, availability management, optional selling price for buy/sell functionality. **Books belong to users** and are tagged to societies - when a user leaves a society, their books are automatically hidden from that society.
- **Rental System**: Borrowing with duration, payment calculation (5% commission), security deposits, tracking, due date management.
- **Buy/Sell Marketplace**: Books can be listed for sale with optional selling price, purchase tracking with bookPurchases table, buy buttons in UI, "Bought" and "Sold" tabs in My Books page, Brocks payment integration for purchases.
- **Brocks Credit System**: Platform currency awarded for actions (upload, referral, borrow, lend), convertible to commission-free days or rupees. Admin-configurable parameters.
- **Referral Program**: Unique codes, Brocks credit rewards, commission-free periods.
- **Enhanced Chat System**: Society chat rooms, one-on-one direct messages, integrated notifications, WebSocket real-time communication, society member directory, unread message tracking, tabbed interface, message history, read status management.
- **Image Recognition**: Multi-provider system (Google Gemini, Anthropic Claude, Google Cloud Vision) for bulk book uploads with automatic failover.
- **Barcode Scanner**: Enhanced camera functionality, improved image processing, direct camera access, professional viewfinder.
- **Gamification**: Brocks ranking system (Explorer to Emperor), leaderboard with progress bars, achievement system.

## External Dependencies

### Payment Processing
- **Razorpay**
- **Stripe** (components prepared)

### Database & Hosting
- **Neon** (Serverless PostgreSQL)
- **Replit** (Development and deployment)

### UI & Utilities
- **Radix UI**
- **Tailwind CSS**
- **React Hook Form**
- **Zod**

### Media & Scanning
- **@zxing/library** (Barcode scanning)
- **Camera API**
- **Google Gemini** (Image recognition)
- **Anthropic Claude** (Image recognition)
- **Google Cloud Vision APIs** (Image recognition)