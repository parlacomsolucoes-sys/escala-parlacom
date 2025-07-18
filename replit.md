# ScheduleMaster

## Overview

ScheduleMaster is a full-stack employee scheduling management system built with modern web technologies. The application uses a monorepo architecture with separate client and server components, Firebase for authentication and data storage, and a comprehensive UI component system.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 18, 2025 - Major Bug Fixes & Custom Schedule Implementation

✅ **Fixed Critical Firebase Connection Issue**
- Resolved Firebase private key decoding error (DECODER routines::unsupported)
- Enhanced private key handling with proper newline and quote processing
- Added comprehensive Firebase connection testing

✅ **Enhanced Error Handling Throughout Application**
- Added detailed error logging in all API routes
- Improved error responses with `message`, `detail`, and `code` fields
- Enhanced authentication middleware error handling
- Added comprehensive logging in storage operations

✅ **Implemented Custom Schedule Functionality**
- Added custom schedule UI in EmployeeModal with per-day time inputs
- Enhanced schema validation for custom schedule objects
- Added visual "Horários Personalizados" badge in employee list
- Fully functional custom schedule creation, editing, and deletion

✅ **Application Debugging & Testing**
- Created comprehensive test suite for employee API operations
- Added detailed logging for all CRUD operations
- Verified end-to-end functionality from frontend to database
- All tests passing successfully

### Technical Improvements Made

1. **Firebase Configuration** (server/firebase-admin.ts)
   - Fixed private key processing with proper escape handling
   - Added validation for PEM format
   - Enhanced initialization logging

2. **API Routes** (server/routes.ts)
   - Added comprehensive request/response logging
   - Enhanced error handling with detailed error information
   - Improved validation error responses

3. **Storage Operations** (server/storage.ts)
   - Added detailed logging for all database operations
   - Enhanced error handling and reporting

4. **Frontend Custom Schedule** (client/src/components/modals/EmployeeModal.tsx)
   - Added dynamic custom schedule inputs for each work day
   - Proper state management for custom schedules
   - Clear UI with placeholders showing default times
   - Remove custom schedule functionality

5. **Employee List Enhancement** (client/src/pages/EmployeesPage.tsx)
   - Added "Horários Personalizados" badge for employees with custom schedules
   - Enhanced visual indication of employee special configurations

## System Architecture

The application follows a monorepo structure with three main directories:

- **client/**: React frontend with Vite, TypeScript, and Tailwind CSS
- **server/**: Express.js backend with TypeScript
- **shared/**: Common types and schemas shared between client and server

### Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Wouter (routing)
- **Backend**: Express.js, TypeScript, Node.js
- **Database**: Firebase Firestore (with Firebase Admin SDK)
- **Authentication**: Firebase Auth
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **State Management**: TanStack Query for server state
- **Validation**: Zod schemas

## Key Components

### Frontend Architecture

The client uses a modern React architecture with:

- **Component Structure**: Organized into pages, components (layout, modals, ui)
- **Routing**: File-based routing with Wouter
- **State Management**: TanStack Query for server state, React Context for auth
- **Styling**: Tailwind CSS with custom brand colors (orange #e8781a primary)
- **Forms**: React Hook Form with Zod validation

### Backend Architecture

The server implements a RESTful API with:

- **Express Routes**: Modular route handling in `/server/routes.ts`
- **Middleware**: Authentication middleware for protected routes
- **Data Layer**: Firestore abstraction through storage service
- **Services**: Business logic separated into service classes

### Authentication System

- **Firebase Auth**: Email/password authentication
- **JWT Tokens**: Firebase ID tokens for API authentication
- **Role-based Access**: Anonymous users (read-only) vs authenticated users (full CRUD)
- **Middleware**: Express middleware for token validation

## Data Flow

### Data Models

1. **Employee**: Staff member with work schedule preferences
   - Personal info (name, active status)
   - Work days and default hours
   - Weekend rotation preferences
   - Custom schedule overrides

2. **Holiday**: Company holidays affecting scheduling
   - Name, date, optional description

3. **Schedule Entries**: Generated monthly schedules
   - Daily assignments with employee-time mappings

### API Endpoints

- `GET /api/employees` - List all employees (public)
- `POST /api/employees` - Create employee (auth required)
- `PATCH /api/employees/:id` - Update employee (auth required)
- `DELETE /api/employees/:id` - Delete employee (auth required)
- Similar CRUD patterns for holidays and schedule entries

### State Management Flow

1. **Authentication State**: Firebase Auth state managed via React Context
2. **Server State**: TanStack Query handles API calls, caching, and synchronization
3. **Form State**: React Hook Form manages form validation and submission
4. **UI State**: Component-level state for modals, loading states

## External Dependencies

### Firebase Integration

- **Firestore**: Primary database for all application data
- **Firebase Auth**: User authentication and authorization
- **Firebase Admin SDK**: Server-side Firebase operations

### UI and Styling

- **Radix UI**: Accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **shadcn/ui**: Pre-built component library

### Development Tools

- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the stack
- **Zod**: Runtime type validation
- **ESBuild**: Fast JavaScript bundler

## Deployment Strategy

### Development Environment

- **Client**: Vite dev server with HMR
- **Server**: tsx for TypeScript execution
- **Database**: Firebase Firestore (development project)

### Production Build

- **Client**: Vite build outputting to `dist/public`
- **Server**: ESBuild bundling to `dist/index.js`
- **Static Serving**: Express serves built client assets

### Environment Configuration

- **Client**: Environment variables prefixed with `VITE_`
- **Server**: Standard Node.js environment variables
- **Firebase**: Service account JSON for admin operations

The application is designed to be deployed as a single Node.js application serving both the API and static frontend assets, with Firebase handling authentication and data persistence.