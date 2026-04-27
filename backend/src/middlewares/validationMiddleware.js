import { ZodError } from "zod";

// Hàm để định dạng lỗi từ Zod thành một cấu trúc dễ hiểu hơn,
// giúp client có thể hiển thị lỗi một cách rõ ràng cho người dùng.
const formatZodErrors = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

// Middleware để xác thực dữ liệu trong body của request dựa trên schema Zod,
// nếu dữ liệu hợp lệ sẽ được gán vào req.validatedData, ngược lại sẽ trả về lỗi 400 với chi tiết lỗi.
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

// Middleware để xác thực dữ liệu trong query của request dựa trên schema Zod,
// nếu dữ liệu hợp lệ sẽ được gán vào req.validatedQuery, ngược lại sẽ trả về lỗi 400 với chi tiết lỗi.
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
