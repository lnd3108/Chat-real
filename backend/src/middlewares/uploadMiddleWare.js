import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Cấu hình Cloudinary với thông tin từ biến môi trường
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
});

// Middleware để xử lý việc tải ảnh lên, 
// sử dụng multer để xử lý file upload từ request và 
// sau đó lưu trữ tạm thời trong bộ nhớ trước khi upload lên Cloudinary.
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

// Hàm để upload ảnh từ buffer lên Cloudinary, 
// trả về kết quả hoặc lỗi thông qua Promise.
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

// Hàm để trích xuất public_id từ URL của Cloudinary, 
// giúp việc xóa ảnh trở nên dễ dàng hơn bằng cách sử dụng public_id thay vì URL đầy đủ.
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

// Hàm để xóa ảnh khỏi Cloudinary bằng public_id, 
// trả về kết quả hoặc lỗi thông qua Promise.
export const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
};

// Hàm để xóa ảnh khỏi Cloudinary bằng URL, 
// sử dụng hàm trích xuất public_id để xác định ảnh cần xóa.
export const deleteImageFromCloudinaryUrl = async (url) => {
  const publicId = extractPublicIdFromCloudinaryUrl(url);
  if (!publicId) return null;
  return deleteImageFromCloudinary(publicId);
};
