function notFound(req, res) {
  res.status(404).json({
    error: {
      message: `Not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

module.exports = notFound;
