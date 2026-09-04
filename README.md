# EMIB - Environmental Monitoring IoT Backend

Real-time agricultural environmental monitoring system with Machine Learning-powered anomaly detection

## Table of Contents

- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technologies Used](#technologies-used)
- [Installation and Setup](#installation-and-setup)
- [API Documentation](#api-documentation)
- [Machine Learning Models](#machine-learning-models)
- [Troubleshooting](#troubleshooting)
- [Author](#Author)
- [License](#license)

## About the Project

EMIB (Environmental Monitoring IoT Backend) is a real-time environmental monitoring and analysis system for agriculture, developed to help farmers monitor and manage environmental conditions in their cultivation areas. The system uses IoT technology combined with Machine Learning to automatically detect sensor data anomalies.

The system can monitor various parameters:
- Temperature
- Humidity
- Carbon Dioxide (CO2)
- pH Value
- Voltage
- Battery Status

## Key Features

### 1. Real-time Monitoring
- Real-time sensor data tracking
- Display data in graphs and numbers
- Instant updates when changes occur

### 2. AI-Powered Anomaly Detection
- Anomaly detection using Machine Learning
- Uses **Ensemble Model** consisting of:
  - Isolation Forest
  - One-Class SVM
  - Random Forest Classifier
  - Gradient Boosting
  - Elliptic Envelope
- Accuracy (F1-Score) over **0.87**

### 3. Smart Notifications
- Instant alerts when anomalies detected
- Push Notifications via Expo
- Alerts when sensors go offline
- Customizable notification settings

### 4. Multi-Zone Management
- Manage multiple cultivation zones
- Add/delete/edit devices in each zone
- View statistics by zone

### 5. Data Visualization & Export
- Display data change graphs
- Select time range to view
- Export data as CSV and PDF
- Detailed statistics and analysis

### 6. User Management
- JWT-based Authentication
- Manage personal information
- Change password
- Upload profile picture

### 7. Multi-language Support
- Support Thai and English
- Easy language switching in app

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Mobile App (React Native + Expo)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │   Home   │  │Statistics│  │ Settings │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (HTTPS)
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Backend Server (Node.js/Express)           │
│  ┌────────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Authentication │  │   Device    │  │Notification │   │
│  │   Controller   │  │ Controller  │  │ Controller  │   │
│  └────────────────┘  └─────────────┘  └─────────────┘   │
│  ┌────────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   User Routes  │  │ Anomaly API │  │Push Service │   │
│  └────────────────┘  └─────────────┘  └─────────────┘   │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           │                      │ HTTP API
    ┌──────▼─────┐       ┌────────▼──────────────────┐
    │  MongoDB   │       │ Anomaly Detection Service │
    │  Database  │       │     (Python/Flask)        │
    │            │       │  ┌──────────────────────┐ │
    │            │       │  │ Pre-trained ML Models│ │
    │            │       │  │ - Isolation Forest   │ │
    │            │       │  │ - One-Class SVM      │ │
    │            │       │  │ - Random Forest      │ │
    │            │       │  │ - Gradient Boosting  │ │
    │            │       │  │ - Elliptic Envelope  │ │
    │            │       │  └──────────────────────┘ │
    └────────────┘       └───────────────────────────┘
```

### Main Components:

#### 1. Frontend (Mobile App)
- **Framework**: React Native + Expo
- **Navigation**: Expo Router
- **State Management**: React Hooks
- **Styling**: Tailwind CSS (twrnc)
- **Charts**: React Native Chart Kit
- **Notifications**: Expo Notifications

#### 2. Backend (Node.js)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcrypt, rate limiting, CORS
- **File Upload**: Multer + GridFS
- **Scheduling**: node-cron

#### 3. ML Service (Python)
- **Framework**: Flask
- **ML Library**: scikit-learn
- **Data Processing**: pandas, numpy
- **Models**: Ensemble of 5+ algorithms
- **Model Storage**: joblib (pickle)

## Technologies Used

### Frontend Technologies
| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.81.5 | Mobile framework |
| Expo | ~54.0.0 | Development platform |
| Expo Router | ~6.0.13 | Navigation |
| Axios | ^1.7.9 | HTTP client |
| twrnc | ^4.9.0 | Tailwind styling |
| i18next | ^24.2.3 | Internationalization |

### Backend Technologies
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express | ^4.21.2 | Web framework |
| MongoDB | 6.0+ | Database |
| Mongoose | ^8.10.0 | ODM |
| JWT | ^9.0.2 | Authentication |
| Expo Server SDK | ^3.15.0 | Push notifications |

### ML Technologies
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10+ | ML runtime |
| scikit-learn | ^1.3.0 | ML algorithms |
| pandas | ^2.1.0 | Data processing |
| numpy | ^1.26.0 | Numerical computing |
| Flask | Latest | ML API server |

## Installation and Setup

### System Requirements

- Node.js 18+
- MongoDB (or MongoDB Compass)
- Ngrok (for testing with physical device)

### Installation Steps

#### 1. Clone Repository

```bash
git clone https://github.com/your-username/emib.git
cd emib
```

#### 2. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

#### 3. Configure Backend (.env)

Create `backend/.env` file:

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/emib-production
SECRET_KEY=your_secret_key_at_least_32_characters
EXPO_ACCESS_TOKEN=your_expo_access_token
```

**Generate SECRET_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get EXPO_ACCESS_TOKEN:**
1. Sign up at https://expo.dev
2. Go to Settings > Access Tokens
3. Create new token

#### 4. Configure Frontend API

Edit `app/utils/config/api.js` line 1:

```javascript
const API_BASE_URL = 'https://your-ngrok-url.ngrok-free.app';  // Change this
```

**Options:**
- **Physical Device**: Use ngrok URL (see next step)
- **Android Emulator**: Use `http://10.0.2.2:3000`
- **iOS Simulator**: Use `http://localhost:3000`

### Running the Project

#### 1. Open MongoDB Compass
- Open MongoDB Compass app
- Connect to `mongodb://localhost:27017`
- MongoDB will run automatically

#### 2. Terminal 1: Backend
```bash
cd backend
npm start
```

#### 3. Terminal 2: Ngrok (if using physical device)
```bash
ngrok http 3000
```
Copy HTTPS URL (e.g., `https://xxxx.ngrok-free.app`) and update in `app/utils/config/api.js`

#### 4. Terminal 3: Frontend
```bash
npm start
```
- Press **a** for Android
- Press **i** for iOS

### Testing

1. Open **Expo Go** app on your phone
2. Scan QR code shown in terminal
3. Create account and test the application

## API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phoneNumber": "0812345678"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "userId": "507f1f77bcf86cd799439011"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john@example.com"
  }
}
```

### Device Endpoints

#### Get All Devices
```http
GET /api/devices
Authorization: Bearer {token}
```

#### Create Device
```http
POST /api/devices
Authorization: Bearer {token}
Content-Type: application/json

{
  "deviceName": "Greenhouse Sensor 1",
  "deviceId": "ESP32_001",
  "zone": "Zone A",
  "description": "Temperature and humidity sensor"
}
```

#### Get Device Sensor Data
```http
GET /api/devices/:deviceId/sensor-data?timeRange=24h
Authorization: Bearer {token}
```

**Query Parameters:**
- `timeRange`: `1h`, `24h`, `7d`, `30d`
- `startDate`: ISO date string
- `endDate`: ISO date string

### Anomaly Detection Endpoints

#### Get Anomalies
```http
GET /api/anomalies?deviceId=507f1f77bcf86cd799439011&limit=50
Authorization: Bearer {token}
```

#### Check for Anomalies (Manual)
```http
POST /api/anomalies/check
Authorization: Bearer {token}
Content-Type: application/json

{
  "deviceId": "507f1f77bcf86cd799439011",
  "sensorData": {
    "temperature": 35.5,
    "humidity": 65.0,
    "co2": 450,
    "ph": 6.8,
    "voltage": 3.7
  }
}
```

### Notification Endpoints

#### Get Notifications
```http
GET /api/notifications?page=1&limit=20
Authorization: Bearer {token}
```

#### Register Push Token
```http
POST /api/notifications/register-token
Authorization: Bearer {token}
Content-Type: application/json

{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

#### Mark as Read
```http
PATCH /api/notifications/:notificationId/read
Authorization: Bearer {token}
```

## Machine Learning Models

### Ensemble Learning Approach

The system uses **Ensemble Model** combining 5 algorithms:

#### 1. Isolation Forest (Weight 25%)
- **Principle**: Isolate outliers using random partitioning
- **Strength**: Fast, works well with high-dimensional data
- **Contamination**: 0.15 (15% of data expected to be anomalies)

#### 2. One-Class SVM (Weight 20%)
- **Principle**: Create decision boundary around normal data
- **Strength**: Works well with non-linear patterns
- **Kernel**: RBF (Radial Basis Function)
- **Nu**: 0.15

#### 3. Local Outlier Factor (Weight 15%)
- **Principle**: Detect local density deviations
- **Strength**: Find local outlier anomalies
- **Novelty**: True (for new data)

#### 4. Random Forest Classifier (Weight 25%)
- **Principle**: Supervised learning ensemble
- **Strength**: High accuracy, resistant to overfitting
- **Estimators**: 100 trees
- **Max Depth**: 10

#### 5. Gradient Boosting Classifier (Weight 15%)
- **Principle**: Sequential ensemble learning
- **Strength**: Very high accuracy
- **Estimators**: 100
- **Learning Rate**: 0.1

### Voting Strategy

```python
# Weighted voting
ensemble_prediction = (
    0.25 * isolation_forest +
    0.20 * one_class_svm +
    0.15 * local_outlier_factor +
    0.25 * random_forest +
    0.15 * gradient_boosting
)

# Final decision
is_anomaly = ensemble_prediction >= 0.5
```

### Feature Engineering

The system calculates additional features to improve performance:

1. **Rolling Statistics** (window = 10):
   - Rolling mean
   - Rolling std
   - Rolling min/max

2. **Rate of Change**:
   - Change rate for each sensor

3. **Time-based Features**:
   - Hour of day
   - Day of week

4. **Interaction Features**:
   - Temperature × Humidity
   - And others

### Model Performance

From testing with test dataset (10,000 samples):

| Model | Precision | Recall | F1-Score | Accuracy |
|-------|-----------|--------|----------|----------|
| Isolation Forest | 0.83 | 0.79 | 0.81 | 0.86 |
| One-Class SVM | 0.78 | 0.82 | 0.80 | 0.84 |
| LOF | 0.75 | 0.77 | 0.76 | 0.82 |
| Random Forest | 0.87 | 0.84 | 0.85 | 0.89 |
| Gradient Boosting | 0.85 | 0.83 | 0.84 | 0.88 |
| **Ensemble** | **0.88** | **0.86** | **0.87** | **0.91** |

### Types of Detected Anomalies

1. **Point Anomalies**: Single point abnormal values
   - Temperature jumping much higher or lower than normal
   - pH value changing suddenly

2. **Contextual Anomalies**: Values abnormal in given context
   - High temperature at night
   - Low humidity during rainy season

3. **Collective Anomalies**: Abnormal patterns
   - Trends changing from normal
   - Patterns inconsistent with history

## Troubleshooting

### MongoDB Not Connecting
- Open MongoDB Compass and connect to `mongodb://localhost:27017`
- MongoDB will run automatically when Compass is open

### Backend Not Running (Port 3000 in use)
```bash
lsof -i :3000  # Find process
kill -9 <PID>  # Kill process
```

### Phone Cannot Connect
- Check ngrok is running
- Check URL in `api.js` is correct
- Press **r** in terminal to reload app

### Push Notifications Not Working
- Check `EXPO_ACCESS_TOKEN` in `.env`
- Push notifications only work on physical device (not on emulator/simulator)
- Check app has notification permission

### Anomaly Detection Not Working
- Backend calls Anomaly Detection service automatically
- Check ML models exist in `backend/anomaly-detection/models/` folder
- If missing, contact project owner

## Author
 
**Sorasak Sanom**
 
- GitHub: [github.com/Sorasak-dev](https://github.com/Sorasak-dev)
- LinkedIn: [linkedin.com/in/sorasak-sanom](https://www.linkedin.com/in/sorasak-sanom)
  
## License

This project was developed for educational and portfolio purposes.
