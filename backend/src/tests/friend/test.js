import Friend from "../../models/Friend.js";

describe("Friend model", () => {
  it("sorts user ids into canonical order before save", async () => {
    const friend = new Friend({
      userA: "ffffffffffffffffffffffff",
      userB: "000000000000000000000001",
    });

    await new Promise((resolve, reject) => {
      friend.constructor.schema.s.hooks.execPre("save", friend, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    expect(friend.userA.toString()).toBe("000000000000000000000001");
    expect(friend.userB.toString()).toBe("ffffffffffffffffffffffff");
  });

  it("keeps already sorted user ids unchanged", async () => {
    const friend = new Friend({
      userA: "000000000000000000000001",
      userB: "ffffffffffffffffffffffff",
    });

    await new Promise((resolve, reject) => {
      friend.constructor.schema.s.hooks.execPre("save", friend, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    expect(friend.userA.toString()).toBe("000000000000000000000001");
    expect(friend.userB.toString()).toBe("ffffffffffffffffffffffff");
  });
});
