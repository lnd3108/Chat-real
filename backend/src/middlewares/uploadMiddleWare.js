import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
});

export const handleSingleImageUpload = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Hình ảnh phải nhỏ hơn 5MB." });
      }

      return res.status(400).json({
        message: "Tải ảnh lên thất bại. Vui lòng thử lại.",
      });
    }

    return res.status(400).json({
      message: error.message || "Không thể tải ảnh lên.",
    });
  });
};

export const uploadImageFromBuffer = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "chat_app/avatars",
        resource_type: "image",
        transformation: [{ width: 200, height: 200, crop: "fill" }],
        ...options,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        } else {
          resolve(result);
        }
      },
    );
    uploadStream.end(buffer);
  });
};

const extractPublicIdFromCloudinaryUrl = (url) => {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const uploadMarker = "/upload/";
    const uploadIndex = parsedUrl.pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return null;
    }

    let assetPath = parsedUrl.pathname.slice(uploadIndex + uploadMarker.length);
    assetPath = assetPath.replace(/^v\d+\//, "");
    assetPath = assetPath.replace(/\.[^/.]+$/, "");

    return assetPath || null;
  } catch {
    return null;
  }
};

export const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
};

export const deleteImageFromCloudinaryUrl = async (url) => {
  const publicId = extractPublicIdFromCloudinaryUrl(url);
  if (!publicId) return null;
  return deleteImageFromCloudinary(publicId);
};
