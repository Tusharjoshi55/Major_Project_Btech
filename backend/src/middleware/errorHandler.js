const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);

  // Multer file size exceeded
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
  }

  // express-validator errors come as arrays, but we pass them through validate middleware
  // This handles any leftover structural errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  // Firebase token errors
  if (err.code?.startsWith('auth/')) {
    return res.status(401).json({ error: 'Authentication error: ' + err.message });
  }

  res.status(err.status || err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;