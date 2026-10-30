
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

dotenv.config();

const app = express();

// Import routes
const authRoutes = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "Expense Tracker API is running!"
  });
});

// Start server after connecting to MongoDB
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
