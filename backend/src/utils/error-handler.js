import { ApiError } from "./api-error.js";

const errorHandler = (err, req, res, next) => {

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors
        });
    }

    return res.status(500).json({
        success: false,
        message: "Internal Server Error"
    });
};

export default errorHandler;