process.env.NODE_ENV = "test";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "root";
process.env.DB_PASSWORD ||= "qwe2683144";
process.env.DB_NAME = process.env.E2E_DB_NAME || process.env.DB_NAME || "qa_community_e2e";
process.env.JWT_SECRET ||= "test_access_secret";
process.env.JWT_EXPIRES_IN ||= "15m";
process.env.REFRESH_SECRET ||= "test_refresh_secret";
process.env.REFRESH_EXPIRES_IN ||= "7d";
process.env.CORS_ORIGIN ||= "http://localhost:5173";

