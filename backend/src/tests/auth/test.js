import request from "supertest";
import express from "express";
import { signUp, signIn } from "../controllers/authControllers.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

// Mock app setup
const app = express();
app.use(express.json());
app.post("/auth/signup", signUp);
app.post("/auth/signin", signIn);

describe("Auth Controller Tests", () => {
  beforeAll(async () => {
    // Connect to test database
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Session.deleteMany({});
  });

  describe("signUp", () => {
    it("should create a new user with valid data", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({
          userName: "testUser123",
          password: "SecurePass123",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toContain("thành công");

      const user = await User.findOne({ userName: "testuser123" });
      expect(user).toBeDefined();
      expect(user.email).toBe("test@example.com");
    });

    it("should reject invalid email", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({
          userName: "testUser123",
          password: "SecurePass123",
          email: "not-an-email",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("xác thực");
    });

    it("should reject weak password", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({
          userName: "testUser123",
          password: "weak",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.statusCode).toBe(400);
    });

    it("should reject duplicate username", async () => {
      // Create first user
      await request(app)
        .post("/auth/signup")
        .send({
          userName: "testUser123",
          password: "SecurePass123",
          email: "test1@example.com",
          firstName: "John",
          lastName: "Doe",
        });

      // Try to create duplicate
      const res = await request(app)
        .post("/auth/signup")
        .send({
          userName: "testUser123",
          password: "SecurePass456",
          email: "test2@example.com",
          firstName: "Jane",
          lastName: "Doe",
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain("tồn tại");
    });
  });

  describe("signIn", () => {
    beforeEach(async () => {
      await request(app)
        .post("/auth/signup")
        .send({
          userName: "testUser123",
          password: "SecurePass123",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
        });
    });

    it("should login with correct credentials", async () => {
      const res = await request(app)
        .post("/auth/signin")
        .send({
          userName: "testUser123",
          password: "SecurePass123",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("thành công");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.userName).toBe("testuser123");
    });

    it("should reject invalid username", async () => {
      const res = await request(app)
        .post("/auth/signin")
        .send({
          userName: "wrongUser",
          password: "SecurePass123",
        });

      expect(res.statusCode).toBe(401);
    });

    it("should reject wrong password", async () => {
      const res = await request(app)
        .post("/auth/signin")
        .send({
          userName: "testUser123",
          password: "WrongPassword123",
        });

      expect(res.statusCode).toBe(401);
    });
  });
});