# BookPotato - Digital Library Platform

## Overview

BookPotato (formerly BorrowBooks and BookShare) is a community-driven digital library platform facilitating book sharing within residential societies, schools, and offices. It enables users to lend and borrow books, buy and sell books, manage rentals with payment processing, utilize barcode scanning for book identification, and participate in a gamification system. The platform aims to create a comprehensive rental and marketplace system, offering a new way for community members to share resources and earn through their book collections.

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
- **Authentication**: Session-based with Google OAuth support, user registration, profile management, admin roles, password reset with email notifications via SendGrid. **Production domain configured** for OAuth at bookpotato.in.
- **Hub Management**: Three hub types (Societies, Schools, Offices), creation with approval, joining, multi-hub support, statistics tracking.
- **Book Management**: Manual entry, barcode scanning, condition tracking, daily rental fees, availability management, optional selling price for buy/sell functionality. **Books belong to users** and are tagged to hubs - when a user leaves a hub, their books are automatically hidden from that hub.
- **Rental System**: Borrowing with duration, payment calculation (10% commission), security deposits, tracking, due date management. **Late Fee Management**: 100% of daily rental rate charged for overdue books, platform commission applied to late fees, automatic deduction from security deposit, Razorpay payment gateway for excess charges.
- **Buy/Sell Marketplace**: Books can be listed for sale with optional selling price, purchase tracking with bookPurchases table, buy buttons in UI, "Bought" and "Sold" tabs in My Books page, Razorpay payment integration for purchases.
- **Brocks Credit System**: Platform currency awarded for actions (upload, referral, borrow, lend), convertible to commission-free days or rupees. Admin-configurable parameters. Razorpay-integrated purchase system.
- **Referral Program**: Unique codes, Brocks credit rewards, commission-free periods.
- **Notifications**: Comprehensive in-app notification system with **automatic email notifications** for all events via SendGrid from **bookpotato.info@gmail.com** (return requests, confirmations, late fees, payments, messages, etc.). SendGrid sender email verified and configured.
- **Enhanced Chat System**: Hub chat rooms (societies/schools/offices), one-on-one direct messages, integrated notifications, WebSocket real-time communication, hub member directory, unread message tracking, tabbed interface, message history, read status management.
- **Image Recognition**: Multi-provider system (Google Gemini, Anthropic Claude, Google Cloud Vision) for bulk book uploads with automatic failover.
- **Barcode Scanner**: Enhanced camera functionality, improved image processing, direct camera access, professional viewfinder.
- **Gamification**: Brocks ranking system (Explorer to Emperor), leaderboard with progress bars, achievement system.

## External Dependencies

### Payment Processing
- **Razorpay** (Book rentals, late fees, excess charges, Brocks purchases, book purchases)
  - API keys configured: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, VITE_RAZORPAY_KEY_ID

### Email Services
- **SendGrid** (Password reset, all in-app notifications)
  - API key configured: SENDGRID_API_KEY
  - Sender email: bookpotato.info@gmail.com (verified)

### Authentication
- **Google OAuth 2.0** (Sign in with Google)
  - Production callback configured for bookpotato.in
  - Development callback for Replit dev domain
  - Automatic domain detection based on PRODUCTION_DOMAIN environment variable

### Database & Hosting
- **Neon** (Serverless PostgreSQL)
- **Replit** (Development and deployment)
- **Production Domain**: bookpotato.in

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

## Recent Updates (October 2025)

### Email Notification System
- Fixed critical recursive bug in `createNotificationWithEmail` function
- All 27+ notification types now send both in-app and email notifications
- SendGrid sender email updated to bookpotato.info@gmail.com
- Automatic email delivery for all user actions (rentals, returns, messages, late fees, etc.)

### OAuth Configuration
- Google OAuth callback URL dynamically configured based on domain
- Production domain (bookpotato.in) fully supported
- Automatic domain detection from PRODUCTION_DOMAIN environment variable
- Seamless sign-in experience on both development and production environments

### Late Fee & Payment Processing
- Enhanced return flow with immediate payment modal for excess charges
- Platform commission (10%) applied to late fees
- Razorpay integration for excess charge payments when late fees exceed security deposit

### Bug Fixes
- Fixed notification system preventing book rentals after payment completion
- Fixed recursive function call causing stack overflow in notification creation
- Payment processing now completes successfully end-to-end
