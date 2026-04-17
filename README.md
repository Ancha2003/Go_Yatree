# GoRide - Professional Auto Booking Platform

GoRide is a full-stack, real-time ride-hailing application specifically designed for Auto (3-wheeler) bookings. It features a robust matching system, real-time tracking, and a hybrid driver ecosystem.

## Key Features Implemented

### 1. Real-Time Ride Matching & Tracking
- **Socket.IO Integration**: Seamless real-time communication between users and drivers.
- **Dynamic Status Stages**: Rides progress through `Searching` → `Confirmed` → `Arriving` → `Ongoing` → `Completed`.
- **Live Map Tracking**: Real-time location updates for both parties using Leaflet maps.

### 2. Hybrid Driver Ecosystem
- **Real Drivers**: Supports registration and online/offline toggling for actual drivers.
- **Demo Drivers**: Intelligent fallback to simulated drivers if no real drivers are nearby, ensuring 100% booking success for testing.
- **Fail-Safe Assignment**: Automatic assignment of a demo driver if a request isn't accepted within 10 seconds.

### 3. User & Driver Experience
- **Profile Management**: Users and drivers can update their profile photos and personal details.
- **Ride Cancellation**: Both parties can cancel ongoing or pending rides with instant notifications.
- **Rating System**: Users can rate drivers after a trip, which updates the driver's average rating in real-time.
- **In-App Messaging**: Real-time chat between user and driver during an active ride.
- **Wallet System**: Integrated balance management for seamless payments.

### 4. Technical Stack
- **Frontend**: React, Tailwind CSS, Lucide Icons, Motion (for animations), Leaflet (for maps).
- **Backend**: Node.js, Express, Socket.IO, MongoDB (Mongoose).
- **Authentication**: JWT-based secure authentication for Users, Drivers, and Admins.

### 5. Admin Dashboard
- Comprehensive management of users, drivers, and rides.
- System configuration for base fares and rates.
- One-click seeding of demo drivers for testing environments.



## Recent Updates
- Fixed location update fetch errors by ensuring auth token presence.
- Added simulated "riders nearby" markers at destinations for a more active map feel.
- Implemented profile photo update functionality for all users.
- Added a robust ride cancellation flow with backend state synchronization.
- Integrated a post-ride rating system to build driver trust.

---
*Developed with precision and care for the GoRide community.*


GORIDE-Project/
├── backend/                  # Server-side logic (Node.js & Express)
│   ├── models/               # MongoDB Database Schemas (Mongoose)
│   │   ├── Ride.ts           # Ride data, status, and cancellation reasons
│   │   ├── SystemConfig.ts   # Global settings (Fare, App state)
│   │   └── User.ts           # User profiles (Driver, Rider, Admin accounts)
│   ├── routes/               # API Endpoints
│   │   ├── adminRoutes.ts    # Dashboard stats, verifying drivers
│   │   ├── authRoutes.ts     # Login, Signup, and JWT handling
│   │   ├── driverRoutes.ts   # Driver availability and earnings
│   │   └── rideRoutes.ts     # Booking, matching, and cancellations
│   └── server.ts             # Main entry point (WebSockets & Express setup)
│
├── frontend/                 # Client-side UI (React & Tailwind)
│   ├── src/
│   │   ├── components/       # Reusable UI Components
│   │   │   ├── Button.tsx    # Custom styled action buttons
│   │   │   ├── Input.tsx     # Form input fields
│   │   │   └── ErrorBoundary.tsx # Global error handling UI
│   │   ├── lib/              # Core Utilities & Configurations
│   │   │   ├── AuthContext.tsx # Global authentication state management
│   │   │   ├── firebase.ts   # Firebase client configuration
│   │   │   ├── socket.ts     # Global WebSocket client instance
│   │   │   └── utils.ts      # Helper functions (formatting, classes)
│   │   ├── screens/          # Application Pages/Views
│   │   │   ├── WelcomeScreen.tsx   # Initial landing page
│   │   │   ├── LoginScreen.tsx     # User authentication
│   │   │   ├── HomeScreen.tsx      # Main passenger map & booking
│   │   │   ├── DriverDashboard.tsx # Driver-specific tools & stats
│   │   │   └── AdminDashboard.tsx  # Admin fleet monitoring & config
│   │   ├── App.tsx           # Main routing and provider setup
│   │   ├── main.tsx          # Application entry point
│   │   └── index.css         # Global styles and Tailwind imports
│
├── .env.example              # Template for environment variables
├── package.json              # Project dependencies and scripts
├── vite.config.ts            # Frontend build configuration
├── tsconfig.json             # TypeScript compiler settings
└── README.md                 # Project documentation and setup guide