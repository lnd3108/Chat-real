import { jest } from "@jest/globals";

const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();
const mockSessionCreate = jest.fn();
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();
const mockJwtSign = jest.fn();
const mockJwtVerify = jest.fn();
const mockRandomBytes = jest.fn();
const mockSignUpParse = jest.fn();
const mockSignInParse = jest.fn();
const mockSendVerificationCodeEmail = jest.fn();
const mockIsMailConfigured = jest.fn(() => true);

jest.unstable_mockModule("../../models/User.js", () => ({
  default: {
    findOne: mockUserFindOne,
    create: mockUserCreate,
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../../models/Session.js", () => ({
  default: {
    create: mockSessionCreate,
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.unstable_mockModule("bcrypt", () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: mockJwtSign,
    verify: mockJwtVerify,
  },
}));

jest.unstable_mockModule("crypto", () => ({
  default: {
    randomBytes: mockRandomBytes,
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => "hashed-code"),
    })),
  },
}));

jest.unstable_mockModule("google-auth-library", () => ({
  OAuth2Client: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.unstable_mockModule("../../libs/validation.js", () => ({
  signUpSchema: { parse: mockSignUpParse },
  signInSchema: { parse: mockSignInParse },
}));

jest.unstable_mockModule("../../utils/mail.js", () => ({
  isMailConfigured: mockIsMailConfigured,
  sendVerificationCodeEmail: mockSendVerificationCodeEmail,
}));

const { signUp, signIn } = await import("../../controllers/authControllers.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    cookie: jest.fn(() => res),
  };

  return res;
};

describe("authControllers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCESS_TOKEN_SECRET = "test-secret";
    mockIsMailConfigured.mockReturnValue(true);
  });

  describe("signUp", () => {
    it("creates a local user and sends verification email", async () => {
      mockSignUpParse.mockReturnValue({
        userName: "TestUser123",
        password: "SecurePass123",
        email: "Test@Example.com",
        firstName: "John",
        lastName: "Doe",
      });
      mockUserFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockBcryptHash.mockResolvedValue("hashed-password");
      mockJwtSign.mockReturnValue("verification-token");

      const createdUser = {
        _id: "user-1",
        userName: "testuser123",
        hashedPassword: "hashed-password",
        email: "test@example.com",
        displayName: "Doe John",
        authProvider: "local",
        emailVerified: false,
        save: jest.fn(),
      };

      mockUserCreate.mockResolvedValue(createdUser);

      const req = { body: {} };
      const res = createRes();

      await signUp(req, res);

      expect(mockUserFindOne).toHaveBeenNthCalledWith(1, {
        userName: "testuser123",
      });
      expect(mockUserFindOne).toHaveBeenNthCalledWith(2, {
        email: "test@example.com",
      });
      expect(mockBcryptHash).toHaveBeenCalledWith("SecurePass123", 10);
      expect(mockUserCreate).toHaveBeenCalledWith({
        userName: "testuser123",
        hashedPassword: "hashed-password",
        email: "test@example.com",
        displayName: "Doe John",
        authProvider: "local",
        emailVerified: false,
      });
      expect(createdUser.save).toHaveBeenCalled();
      expect(mockSendVerificationCodeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresEmailVerification: true,
          verificationToken: "verification-token",
          email: "test@example.com",
          purpose: "signup",
          resendAvailableAt: expect.any(Number),
          message:
            "Đã gửi mã xác minh tới email của bạn. Vui lòng xác minh trước khi đăng nhập.",
        }),
      );
    });

    it("rejects duplicate usernames", async () => {
      mockSignUpParse.mockReturnValue({
        userName: "TestUser123",
        password: "SecurePass123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      mockUserFindOne.mockResolvedValueOnce({ _id: "existing-user" });

      const req = { body: {} };
      const res = createRes();

      await signUp(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: "userName đã tồn tại" });
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  describe("signIn", () => {
    it("returns token, session and cookie when credentials are valid", async () => {
      mockSignInParse.mockReturnValue({
        userName: "TestUser123",
        password: "SecurePass123",
      });
      mockUserFindOne.mockResolvedValue({
        _id: "user-1",
        userName: "testuser123",
        displayName: "Doe John",
        email: "test@example.com",
        avatarUrl: null,
        authProvider: "local",
        emailVerified: true,
        hashedPassword: "hashed-password",
      });
      mockBcryptCompare.mockResolvedValue(true);
      mockJwtSign.mockReturnValue("access-token");
      mockRandomBytes.mockReturnValue({
        toString: jest.fn(() => "refresh-token"),
      });
      mockSessionCreate.mockResolvedValue({ _id: "session-1" });

      const req = { body: {} };
      const res = createRes();

      await signIn(req, res);

      expect(mockUserFindOne).toHaveBeenCalledWith({ userName: "testuser123" });
      expect(mockBcryptCompare).toHaveBeenCalledWith(
        "SecurePass123",
        "hashed-password",
      );
      expect(mockJwtSign).toHaveBeenCalledWith(
        { userId: "user-1" },
        "test-secret",
        { expiresIn: "30m" },
      );
      expect(mockSessionCreate).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "refresh-token",
        expect.objectContaining({ httpOnly: true, maxAge: expect.any(Number) }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "access-token",
          user: expect.objectContaining({ userName: "testuser123" }),
        }),
      );
    });

    it("returns a verification session for unverified local users", async () => {
      mockSignInParse.mockReturnValue({
        userName: "TestUser123",
        password: "SecurePass123",
      });
      mockUserFindOne.mockResolvedValue({
        _id: "user-1",
        userName: "testuser123",
        displayName: "Doe John",
        email: "test@example.com",
        avatarUrl: null,
        authProvider: "local",
        emailVerified: false,
        hashedPassword: "hashed-password",
        save: jest.fn(),
      });
      mockBcryptCompare.mockResolvedValue(true);
      mockJwtSign.mockReturnValue("verification-token");

      const req = { body: {} };
      const res = createRes();

      await signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockSendVerificationCodeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresEmailVerification: true,
          verificationToken: "verification-token",
          email: "test@example.com",
          purpose: "signup",
          resendAvailableAt: expect.any(Number),
          message:
            "Email cua ban chua duoc xac minh. Chung toi da gui lai ma xac minh.",
        }),
      );
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("rejects invalid credentials", async () => {
      mockSignInParse.mockReturnValue({
        userName: "wrongUser",
        password: "SecurePass123",
      });
      mockUserFindOne.mockResolvedValue(null);

      const req = { body: {} };
      const res = createRes();

      await signIn(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "userName hoac Password khong chinh xac",
      });
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });
  });
});
