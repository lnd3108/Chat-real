import { jest } from "@jest/globals";

const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindByIdAndDelete = jest.fn();
const mockUserCreate = jest.fn();
const mockSessionCreate = jest.fn();
const mockSessionDeleteMany = jest.fn();
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();
const mockJwtSign = jest.fn();
const mockJwtVerify = jest.fn();
const mockRandomBytes = jest.fn();
const mockSignUpParse = jest.fn();
const mockSignInParse = jest.fn();
const mockSendVerificationCodeEmail = jest.fn();
const mockSendAccountDeletionCodeEmail = jest.fn();
const mockSendAccountDeletedEmail = jest.fn();
const mockIsMailConfigured = jest.fn(() => true);

jest.unstable_mockModule("../../models/User.js", () => ({
  default: {
    findOne: mockUserFindOne,
    findById: mockUserFindById,
    findByIdAndDelete: mockUserFindByIdAndDelete,
    create: mockUserCreate,
  },
}));

jest.unstable_mockModule("../../models/Session.js", () => ({
  default: {
    create: mockSessionCreate,
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: mockSessionDeleteMany,
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
  sendAccountDeletionCodeEmail: mockSendAccountDeletionCodeEmail,
  sendAccountDeletedEmail: mockSendAccountDeletedEmail,
}));

const {
  signUp,
  signIn,
  requestAccountDeletion,
  confirmAccountDeletion,
} = await import("../../controllers/authControllers.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    cookie: jest.fn(() => res),
    clearCookie: jest.fn(() => res),
    sendStatus: jest.fn(() => res),
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
        }),
      );
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
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });
  });

  describe("account deletion", () => {
    it("sends an account deletion code to email", async () => {
      const save = jest.fn();
      mockUserFindById.mockResolvedValue({
        _id: "user-1",
        email: "test@example.com",
        displayName: "Doe John",
        save,
      });

      const req = { user: { _id: "user-1" } };
      const res = createRes();

      await requestAccountDeletion(req, res);

      expect(save).toHaveBeenCalled();
      expect(mockSendAccountDeletionCodeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          displayName: "Doe John",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          email: "test@example.com",
          expiresAt: expect.any(Number),
          resendAvailableAt: expect.any(Number),
        }),
      );
    });

    it("deletes the account after correct verification code", async () => {
      mockUserFindById.mockResolvedValue({
        _id: "user-1",
        email: "test@example.com",
        displayName: "Doe John",
        accountDeletionCodeHash: "hashed-code",
        accountDeletionExpiresAt: new Date(Date.now() + 60_000),
      });

      const req = {
        user: { _id: "user-1" },
        body: {
          confirmationText: "DELETE",
          code: "123456",
        },
      };
      const res = createRes();

      await confirmAccountDeletion(req, res);

      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ userId: "user-1" });
      expect(mockUserFindByIdAndDelete).toHaveBeenCalledWith("user-1");
      expect(res.clearCookie).toHaveBeenCalledWith("refreshToken");
      expect(mockSendAccountDeletedEmail).toHaveBeenCalledWith({
        email: "test@example.com",
        displayName: "Doe John",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Xóa tài khoản thành công.",
      });
    });
  });
});
