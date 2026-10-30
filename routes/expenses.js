
const express = require("express");
const Expense = require("../models/Expense");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All routes below require login
router.use(authMiddleware);

// Add an expense
router.post("/", async (req, res) => {
  try {
    const { title, amount, category, date, notes } = req.body;

    if (!title || amount === undefined || !category) {
      return res.status(400).json({
        message: "Title, amount and category are required."
      });
    }

    const expense = await Expense.create({
      user: req.userId,
      title,
      amount,
      category,
      date: date || Date.now(),
      notes: notes || ""
    });

    res.status(201).json({
      message: "Expense added successfully!",
      expense
    });
  } catch (error) {
    res.status(400).json({
      message: "Could not add expense. Check the entered details."
    });
  }
});

// View expenses, with optional search and filters

 // View expenses, with optional search and filters
router.get("/", async (req, res) => {
  try {
    const { search, category, startDate, endDate } = req.query;

    const filter = { user: req.userId };

    // Search expense titles, ignoring uppercase/lowercase
    if (search && search.trim()) {
      filter.title = {
        $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i"
      };
    }

    // Filter by category
    if (category && category.trim()) {
      filter.category = category;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.date = {};

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000`);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            message: "Invalid start date."
          });
        }
        filter.date.$gte = start;
      }

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            message: "Invalid end date."
          });
        }
        filter.date.$lte = end;
      }
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    console.error("Filter expenses error:", error);
    res.status(500).json({
      message: "Could not fetch expenses."
    });
  }
});


// Update an expense
router.put("/:id", async (req, res) => {
  try {
    const allowedFields = ["title", "amount", "category", "date", "notes"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found."
      });
    }

    res.json({ message: "Expense updated successfully!", expense });
  } catch (error) {
    res.status(400).json({ message: "Could not update expense." });
  }
});

// Delete an expense
router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found."
      });
    }

    res.json({ message: "Expense deleted successfully!" });
  } catch (error) {
    res.status(400).json({ message: "Could not delete expense." });
  }
});

// Total expenses
router.get("/summary/total", async (req, res) => {
  try {
    const result = await Expense.aggregate([
      { $match: { user: new (require("mongoose").Types.ObjectId)(req.userId) } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]);

    res.json({
      total: result[0]?.total || 0,
      count: result[0]?.count || 0
    });
  } catch (error) {
    res.status(500).json({ message: "Could not calculate total." });
  }
});

// Monthly expense summary
router.get("/summary/monthly", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const result = await Expense.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } }
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Could not calculate monthly summary." });
  }
});

// Expense totals grouped by category
router.get("/summary/category", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const result = await Expense.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Could not calculate category summary." });
  }
});

module.exports = router;
