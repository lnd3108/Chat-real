import { ZodError } from "zod";

const formatZodErrors = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedData = validated;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Dữ liệu không hợp lệ",
          errors: formatZodErrors(error),
        });
      }

      return res.status(400).json({
        message: "Lỗi xác thực dữ liệu",
      });
    }
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Lỗi xác thực query",
          errors: formatZodErrors(error),
        });
      }

      return res.status(400).json({
        message: "Lỗi xác thực query",
      });
    }
  };
};
