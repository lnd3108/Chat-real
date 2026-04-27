import { z } from "zod";

// validate input đầu vào
export const signUpSchema = z.object({
  userName: z
    .string()
    .min(3, "Username phải tối thiểu 3 ký tự")
    .max(30, "Username tối đa 30 ký tự")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username chỉ chứa chữ, số, gạch ngang, gạch dưới"),
  password: z
    .string()
    .min(6, "Password phải tối thiểu 6 ký tự")
    .regex(/[A-Z]/, "Password phải có ít nhất 1 chữ hoa")
    .regex(/[0-9]/, "Password phải có ít nhất 1 số"),
  email: z.string().email("Email không hợp lệ"),
  firstName: z.string().min(1, "Tên không được trống"),
  lastName: z.string().min(1, "Họ không được trống"),
});

// validate input đầu vào
export const signInSchema = z.object({
  userName: z.string().min(1, "Yêu cầu username"),
  password: z.string().min(1, "Yêu cầu password"),
});

// validate input đầu vào
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
});

export const verifyForgotPasswordOtpSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP phải gồm đúng 6 chữ số"),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().trim().email("Email không hợp lệ"),
    resetToken: z.string().min(1, "Thiếu resetToken"),
    resetTokenValue: z.string().min(1, "Thiếu resetTokenValue"),
    newPassword: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ hoa")
      .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
      .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirmPassword"],
  });

// User Validation
export const updateUserSchema = z.object({
  displayName: z.string().min(1, "Tên hiển thị không được trống").optional(),
  userName: z
    .string()
    .min(3, "Username phải tối thiểu 3 ký tự")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username không hợp lệ")
    .optional(),
  email: z.string().email("Email không hợp lệ").optional(),
  phone: z.string().regex(/^[0-9+\-\s()]+$/, "Số điện thoại không hợp lệ").optional(),
  bio: z.string().max(500, "Bio tối đa 500 ký tự").optional(),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  showOnlineStatus: z.boolean().optional(),
});

// Message Validation
export const sendDirectMessageSchema = z.object({
  recipientId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
  content: z.string().min(1, "Tin nhắn không được trống").max(5000, "Tin nhắn tối đa 5000 ký tự"),
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ").optional(),
});

export const sendGroupMessageSchema = z.object({
  conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
  content: z.string().min(1, "Tin nhắn không được trống").max(5000, "Tin nhắn tối đa 5000 ký tự"),
  imgUrl: z.string().url("URL hình ảnh không hợp lệ").optional(),
});

// Conversation Validation
export const createConversationSchema = z.object({
  type: z.enum(["direct", "group"], {
    errorMap: () => ({ message: "Type phải là 'direct' hoặc 'group'" }),
  }),
  name: z
    .string()
    .min(1, "Tên nhóm không được trống")
    .max(100, "Tên nhóm tối đa 100 ký tự")
    .optional(),
  memberIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"))
    .min(1, "Phải có ít nhất 1 thành viên"),
});

export const addGroupMemberSchema = z.object({
  memberIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"))
    .min(1, "Phải có ít nhất 1 thành viên"),
});

export const removeGroupMemberSchema = z.object({
  memberId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
});
