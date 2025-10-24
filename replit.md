# BookPotato - Digital Library Platform

## Overview

BookPotato is a community-driven digital library platform designed for residential societies, schools, and offices. Its core purpose is to facilitate book sharing through lending, borrowing, buying, and selling. Key capabilities include rental management with payment processing, barcode scanning for book identification, a gamification system (Brocks credits and ranking), and real-time communication. The platform aims to foster a vibrant book-sharing ecosystem within defined communities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript, Wouter for routing, and TanStack Query for state management. UI components are built with Radix UI primitives and customized using shadcn/ui, styled with Tailwind CSS and custom HSL color variables. Form handling is managed by React Hook Form with Zod validation.

### Technical Implementations
The backend is built with Node.js 20.x and Express.js, written in TypeScript with ES modules. It exposes a RESTful API using JSON payloads. Session management is handled by Express sessions stored in PostgreSQL, secured with HTTP-only cookies. Authentication supports both local email/password and Google OAuth strategies via Passport.js. The project follows a monorepo structure (`client/`, `server/`, `shared/`).

### Feature Specifications
- **Authentication**: Supports Google OAuth and local login with email/password. Sessions are managed in PostgreSQL with 7-day expiry.
- **Book Rentals**: Users can borrow books with calculated fees (rental, platform commission, security deposit). Payment options include Brocks credits or Razorpay. Brocks credits are awarded to both borrowers and lenders upon rental completion.
- **Late Fee System**: Automatically calculates late fees based on daily rates. If late fees exceed the security deposit, users must pay the excess via Razorpay before return confirmation.
- **Brocks Credit System**: A gamified credit system where users earn Brocks for actions like signing up, uploading books, borrowing/lending, and referrals. Brocks can be converted to discounts or commission-free days. A ranking system based on total Brocks earned provides user tiers.
- **Notification & Email System**: In-app notifications and email alerts (via SendGrid) for various events like rental status updates, messages, payments, and hub activities. Email sending is asynchronous.
- **Buy/Sell Marketplace**: Users can buy and sell books. Purchases can be made via Razorpay or Brocks.
- **Real-Time Chat**: WebSocket-based chat system for direct messages between users and within hubs. Tracks unread messages and provides real-time updates.
- **Hub Management**: Supports creating and joining community hubs (Society, School, Office). Books uploaded by members are tagged with their active hubs, controlling visibility. Hubs require admin approval.

### System Design Choices
- **Database**: PostgreSQL 15 (hosted on Neon serverless) is used with Drizzle ORM for type-safe queries and migrations (Drizzle Kit).
- **Payment Gateway**: Razorpay is integrated for all monetary transactions.
- **Email Service**: SendGrid is used for all email notifications.
- **Scalability**: Designed with a serverless database (Neon) and asynchronous email sending for better performance and scalability.

## External Dependencies

- **Razorpay**: Integrated for processing payments related to book rentals, late fees, excess charges, Brocks purchases, and direct book purchases.
- **SendGrid**: Utilized for sending all transactional emails and notifications.
- **Google OAuth 2.0**: Used for simplified user authentication via Google accounts.
- **Neon**: Provides serverless PostgreSQL database hosting.
- **Replit**: Development and deployment environment.