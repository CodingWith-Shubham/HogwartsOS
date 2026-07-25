import { ApiError } from "../utils/api-error.js";

export const validate = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            return next(
                new ApiError(
                    400,
                    error.issues?.[0]?.message || "Validation failed",
                    error.issues || []
                )
            );
        }
    };
};