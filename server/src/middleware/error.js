export const notFound = (_req, res) => {
  res.status(404).json({ message: "Not Found" });
};

export const errorHandler = (error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ message: error.message || "Internal Server Error" });
};