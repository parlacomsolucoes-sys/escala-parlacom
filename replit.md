# ScheduleMaster

## Overview

ScheduleMaster is a comprehensive full-stack employee scheduling management system built with modern web technologies. The application features advanced scheduling capabilities including holiday recurrence patterns, custom employee schedules, and automated weekend rotations. It uses a monorepo architecture with separate client and server components, Firebase for authentication and data storage, and a sophisticated UI component system.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 18, 2025 - Enhanced Weekend Rotation System Implementation

✅ **Advanced Weekend Rotation Algorithm**
- Implemented sophisticated alternation patterns for 2+ employees
- Created RotationMeta collection for persistent rotation state tracking  
- Added support for single, pair, and multiple employee rotation scenarios
- Automatic alternation: Week 1 (Sat=A, Sun=B) → Week 2 (Sat=B, Sun=A)
- Circular queue system for >2 employees with fair distribution

✅ **Enhanced Date Handling & Timezone Safety**
- Fixed all timezone bugs by replacing toISOString() with formatDateKey()
- Implemented consistent YYYY-MM-DD internal format throughout
- Enhanced holiday schema to support MM-DD format with backward compatibility
- Added comprehensive date utility functions for timezone-safe operations
- Fixed "Invalid Date" display issues in holiday management

✅ **Fixed Day Click Behavior** 
- Corrected day click handler to only open DayEditModal (no navigation)
- Removed auto-switch to day view when clicking calendar dates
- Implemented modal-only editing for better user experience
- Fixed date offset issues causing incorrect day modal openings

✅ **Comprehensive Rotation Metadata System**
- Added rotationIndex and swapParity tracking for fair employee distribution
- Monthly rotation state persistence (YYYY-MM document structure)
- Idempotent weekend generation prevents duplicate assignments
- Smart conflict resolution when manual edits conflict with rotation

✅ **Enhanced API Response Structure**
- Extended weekend generation response with detailed metrics
- Added pattern recognition ("single", "pair", "multiple")
- Included updatedDays array and comprehensive statistics
- Enhanced logging with structured prefixes for debugging

✅ **Production-Ready Features**
- Comprehensive test suite with 8/8 functional tests passing
- Security: Authentication required for modification endpoints
- Error handling: Graceful degradation and detailed error responses
- Performance: Efficient date calculations and minimal API calls
- Maintainability: Clear separation of concerns and helper functions

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