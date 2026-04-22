import { jest } from "@jest/globals";

const mockFriendFindOneAndDelete = jest.fn();
const mockFriendRequestDeleteMany = jest.fn();
const mockUserFindById = jest.fn();
const mockConversationDeleteOne = jest.fn();
const mockMessageFind = jest.fn();
const mockMessageDeleteMany = jest.fn();
const mockFindDirectConversationBetweenUsers = jest.fn();
const mockDeleteImageFromCloudinary = jest.fn();
const mockDeleteImageFromCloudinaryUrl = jest.fn();
const mockEmitConversationDeletedForUsers = jest.fn();
const mockEmitFriendRemoved = jest.fn();

jest.unstable_mockModule("../../models/Friend.js", () => ({
  default: {
    findOneAndDelete: mockFriendFindOneAndDelete,
  },
}));

jest.unstable_mockModule("../../models/FriendRequest.js", () => ({
  default: {
    deleteMany: mockFriendRequestDeleteMany,
  },
}));

jest.unstable_mockModule("../../models/User.js", () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule("../../models/Conversation.js", () => ({
  default: {
    deleteOne: mockConversationDeleteOne,
  },
}));

jest.unstable_mockModule("../../models/Message.js", () => ({
  default: {
    find: mockMessageFind,
    deleteMany: mockMessageDeleteMany,
  },
}));

jest.unstable_mockModule("../../modules/chat/domain/direct-blocking.policy.js", () => ({
  findDirectConversationBetweenUsers: mockFindDirectConversationBetweenUsers,
}));

jest.unstable_mockModule(
  "../../shared/infrastructure/realtime/friendship-realtime.js",
  () => ({
    emitConversationDeletedForUsers: mockEmitConversationDeletedForUsers,
    emitFriendRemoved: mockEmitFriendRemoved,
    emitFriendRequestAccepted: jest.fn(),
    emitFriendRequestReceived: jest.fn(),
    emitFriendRequestRemoved: jest.fn(),
    emitFriendRequestSent: jest.fn(),
  }),
);

jest.unstable_mockModule("../../middlewares/uploadMiddleWare.js", () => ({
  deleteImageFromCloudinary: mockDeleteImageFromCloudinary,
  deleteImageFromCloudinaryUrl: mockDeleteImageFromCloudinaryUrl,
}));

const { removeFriend } = await import("../../modules/friendship/api/http/friend.controller.js");

const createRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe("friendController.removeFriend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "target-user" }),
    });
    mockFriendFindOneAndDelete.mockResolvedValue({ _id: "friendship-1" });
    mockFriendRequestDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockMessageDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockConversationDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockMessageFind.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    mockDeleteImageFromCloudinary.mockResolvedValue({});
    mockDeleteImageFromCloudinaryUrl.mockResolvedValue({});
  });

  it("removes friendship, direct conversation, and emits both events", async () => {
    mockFindDirectConversationBetweenUsers.mockResolvedValue({ _id: "conversation-1" });
    mockMessageFind.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { imgPublicId: "cloudinary-public-id", imgUrl: null },
        { imgPublicId: null, imgUrl: "https://cdn.example.com/image.jpg" },
      ]),
    });

    const req = {
      user: { _id: "user-1" },
      params: { targetUserId: "target-user" },
    };
    const res = createRes();

    await removeFriend(req, res);

    expect(mockFriendFindOneAndDelete).toHaveBeenCalledWith({
      userA: "target-user",
      userB: "user-1",
    });
    expect(mockMessageFind).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      $or: [{ imgPublicId: { $ne: null } }, { imgUrl: { $ne: null } }],
    });
    expect(mockDeleteImageFromCloudinary).toHaveBeenCalledWith("cloudinary-public-id");
    expect(mockDeleteImageFromCloudinaryUrl).toHaveBeenCalledWith(
      "https://cdn.example.com/image.jpg",
    );
    expect(mockMessageDeleteMany).toHaveBeenCalledWith({
      conversationId: "conversation-1",
    });
    expect(mockConversationDeleteOne).toHaveBeenCalledWith({
      _id: "conversation-1",
    });
    expect(mockEmitConversationDeletedForUsers).toHaveBeenCalledWith({
      userIds: ["user-1", "target-user"],
      conversationId: "conversation-1",
    });
    expect(mockEmitFriendRemoved).toHaveBeenCalledWith({
      userIds: ["user-1", "target-user"],
      payload: {
        userId: "user-1",
        targetUserId: "target-user",
        conversationId: "conversation-1",
        clearedDirectChat: true,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Da huy ket ban thanh cong",
      conversationId: "conversation-1",
      clearedDirectChat: true,
    });
  });

  it("still emits friend removal when no direct conversation exists", async () => {
    mockFindDirectConversationBetweenUsers.mockResolvedValue(null);

    const req = {
      user: { _id: "user-1" },
      params: { targetUserId: "target-user" },
    };
    const res = createRes();

    await removeFriend(req, res);

    expect(mockMessageFind).not.toHaveBeenCalled();
    expect(mockMessageDeleteMany).not.toHaveBeenCalled();
    expect(mockConversationDeleteOne).not.toHaveBeenCalled();
    expect(mockEmitFriendRemoved).toHaveBeenCalledWith({
      userIds: ["user-1", "target-user"],
      payload: {
        userId: "user-1",
        targetUserId: "target-user",
        conversationId: null,
        clearedDirectChat: false,
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Da huy ket ban thanh cong",
      conversationId: null,
      clearedDirectChat: false,
    });
  });
});
