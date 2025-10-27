const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";

const isDevelopment = process.env.NODE_ENV !== 'production';
const ENABLE_DEBUG_LOGS = process.env.ENABLE_DEBUG_LOGS === 'true' || isDevelopment;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      message: "Access token is missing or invalid" 
    });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; 
    next();
  } catch (err) {
    if (ENABLE_DEBUG_LOGS || err.name !== 'TokenExpiredError') {
      console.error("Token verification failed:", err.message);
    }
    
    const message = err.name === 'TokenExpiredError' 
      ? 'Token expired' 
      : 'Invalid token';
    
    res.status(403).json({ message });
  }
};

module.exports = authenticateToken;