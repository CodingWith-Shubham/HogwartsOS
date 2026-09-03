import { Expense } from "../models/expense.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";

const getAllExpenses = asyncHandler(async (req, res) => {
    const { startDate, endDate, category } = req.query;

    let filter = {};
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }
    
    if (category && category !== 'all') {
        filter.category = category;
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });

    const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return res.status(200).json(new ApiResponse(200, {
        expenses,
        metrics: {
            totalExpense
        }
    }, "Expenses retrieved successfully"));
});

const createExpense = asyncHandler(async (req, res) => {
    const { amount, category, description, date } = req.body;
    
    if (!amount || !category || !date) {
        throw new ApiError(400, "Amount, category, and date are required");
    }

    const expense = await Expense.create({
        amount: Number(amount),
        category,
        description,
        date: new Date(date),
        recordedBy: req.user?.name || req.user?.email || "System"
    });

    return res.status(201).json(new ApiResponse(201, expense, "Expense created successfully"));
});

const updateExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, category, description, date } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
        throw new ApiError(404, "Expense not found");
    }

    if (amount !== undefined) expense.amount = Number(amount);
    if (category !== undefined) expense.category = category;
    if (description !== undefined) expense.description = description;
    if (date !== undefined) expense.date = new Date(date);

    await expense.save();

    return res.status(200).json(new ApiResponse(200, expense, "Expense updated successfully"));
});

const deleteExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
        throw new ApiError(404, "Expense not found");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Expense deleted successfully"));
});

export { getAllExpenses, createExpense, updateExpense, deleteExpense };
