import { Router } from "express";
import { 
    getAllExpenses, 
    createExpense, 
    updateExpense, 
    deleteExpense 
} from "../controllers/expense.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Apply auth middleware to all routes in this file
router.use(verifyJWT);

router.route("/")
    .get(getAllExpenses)
    .post(createExpense);

router.route("/:id")
    .put(updateExpense)
    .delete(deleteExpense);

export default router;
