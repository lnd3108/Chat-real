import {
  handleSingleImageUpload,
  upload,
} from "../../../middlewares/uploadMiddleWare.js";
import { validateRequest } from "../../../middlewares/validationMiddleware.js";

export const validateBody = (schema) => validateRequest(schema);

export const uploadSingleFile = (fieldName) => upload.single(fieldName);

export const uploadSingleImage = (fieldName) => handleSingleImageUpload(fieldName);
