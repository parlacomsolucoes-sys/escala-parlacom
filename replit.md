# ScheduleMaster

## Overview

ScheduleMaster is a comprehensive full-stack employee scheduling management system built with modern web technologies. The application features advanced scheduling capabilities including holiday recurrence patterns, custom employee schedules, and automated weekend rotations. It uses a monorepo architecture with separate client and server components, Firebase for authentication and data storage, and a sophisticated UI component system.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 18, 2025 - Complete 7-Phase Enhancement Plan Implementation

✅ **Phase 1: Holiday Recurrence System (MM-DD Format)**
- Implemented MM-DD format for holiday dates (e.g., "12-25" for Christmas)
- Created migration script for existing holidays to new format
- Enhanced schema validation for holiday recurrence patterns
- Holidays now automatically recur every year without manual re-entry

✅ **Phase 2: Idempotent Weekend Schedule Generation**
- Fixed critical 500 error caused by incorrect ScheduleService instantiation
- Implemented robust idempotency with force parameter support
- Enhanced API endpoint with comprehensive validation and error handling
- Added detailed response metrics (changedCount, skippedHolidays, etc.)
- Round-robin assignment ordered by employee name for consistency

✅ **Phase 3: Multiple View Modes (Month/Week/Day)**
- Implemented 3 view modes: Month (grid), Week (horizontal), Day (detailed)
- Added view mode toggle buttons with proper state management
- Auto-switch to day view when clicking on calendar dates
- Enhanced navigation with week-specific controls
- Improved data filtering for each view mode

✅ **Phase 4: Information Dashboard Panel**
- Added "Próximos Finais de Semana" card showing next 2 weekends
- Added "Próximos Feriados" card displaying next 3 holidays
- Real-time status indicators (generated vs "não gerado")
- Automatic refresh after weekend schedule generation
- Clear visual distinction between scheduled and unscheduled days

✅ **Phase 5: Enhanced Assignment Legibility**
- Improved assignment sorting by employee name (case-insensitive)
- Limited month view to 2 assignments + "+N mais" indicator
- Enhanced day view with full expanded assignment details
- Added visual badges and improved spacing for readability

✅ **Phase 7: Holiday Form Enhancements**
- Updated HolidayModal to handle MM-DD format input conversion
- Added conversion from full date picker to MM-DD format
- Enhanced form labels and help text for better user experience
- Improved format explanations and validation

✅ **Phase 8: Comprehensive Testing & Validation**
- Executed 10 systematic test scenarios with 100% pass rate
- Validated idempotency, error handling, and all view modes
- Confirmed API responses match expected format and status codes
- Verified holiday awareness and weekend rotation functionality

✅ **Complete System Integration**
- All API endpoints working correctly without 500 errors
- Frontend hot-reload and Firebase integration functioning perfectly
- Comprehensive logging system with structured prefixes
- Security validations and token handling properly implemented

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