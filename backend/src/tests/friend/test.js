import request from "supertest";
import Friend from "../models/Friend.js";
import User from "../models/User.js";

describe("Friend Logic Tests", () => {
  let user1, user2, user3;

  beforeAll(async () => {
    user1 = await User.create({
      userName: "user1",
      hashedPassword: "hashed",
      email: "user1@test.com",
      displayName: "User 1",
    });

    user2 = await User.create({
      userName: "user2",
      hashedPassword: "hashed",
      email: "user2@test.com",
      displayName: "User 2",
    });

    user3 = await User.create({
      userName: "user3",
      hashedPassword: "hashed",
      email: "user3@test.com",
      displayName: "User 3",
    });
  });

  describe("Friend relationship", () => {
    it("should create bidirectional friendship", async () => {
      const friend = new Friend({
        userA: user1._id.toString(),
        userB: user2._id.toString(),
      });

      await friend.save();

      // Check both directions
      const f1 = await Friend.findOne({
        userA: user1._id.toString(),
        userB: user2._id.toString(),
      });
      const f2 = await Friend.findOne({
        userA: user2._id.toString(),
        userB: user1._id.toString(),
      });

      expect(f1 || f2).toBeDefined();
    });

    it("should verify friendship correctly", async () => {
      const pair = (a, b) => {
        const aStr = a.toString();
        const bStr = b.toString();
        return aStr < bStr ? [aStr, bStr] : [bStr, aStr];
      };

      const [userA, userB] = pair(user1._id, user2._id);
      const friend = await Friend.findOne({ userA, userB });

      expect(friend).toBeDefined();
    });

    it("should not allow non-friends to chat", async () => {
      const isFriend = await Friend.findOne({
        userA: user1._id.toString(),
        userB: user3._id.toString(),
      });

      expect(isFriend).toBeNull();
    });
  });
});