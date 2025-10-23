const errorHandler = (err, req, res, next) => {
  console.error('Middleware error handler:', err.stack);

  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined, 
  });
};

module.exports = errorHandler;