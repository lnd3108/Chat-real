import mongoose from "mongoose";
import User from "../models/User.js";
import { getFriendshipDiscoveryUserFilter } from "../services/friendshipPolicyService.js";

const toObjectIds = (ids = []) =>
  ids
    .map((id) => {
      if (id instanceof mongoose.Types.ObjectId) {
        return id;
      }

      return mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : null;
    })
    .filter(Boolean);

const buildBaseMatch = (excludedIds = []) => {
  const objectIds = toObjectIds(excludedIds);
  const match = {
    ...getFriendshipDiscoveryUserFilter(),
  };

  if (objectIds.length > 0) {
    match._id = { $nin: objectIds };
  }

  return match;
};

export const findRandomDiscoverableUsers = async ({
  excludedIds = [],
  limit = 5,
}) => {
  const normalizedLimit = Math.max(1, Math.min(limit, 5));
  const objectIds = toObjectIds(excludedIds);
  const match = {
    ...getFriendshipDiscoveryUserFilter(),
  };

  if (objectIds.length > 0) {
    match._id = { $nin: objectIds };
  }

  // First, try to get random samples
  let results = await User.aggregate([
    {
      $match: match,
    },
    {
      $sample: { size: normalizedLimit },
    },
    {
      $project: {
        _id: 1,
        displayName: 1,
        userName: 1,
        avatarUrl: 1,
        role: 1,
        status: 1,
      },
    },
  ]);

  // Nếu không lấy được đủ số lượng kết quả,
  // thì thử lấy thêm dữ liệu mà không dùng sampling.
  // Trường hợp này có thể xảy ra khi số user đủ điều kiện ít hơn limit.
  if (results.length < normalizedLimit) {
    const additionalLimit = normalizedLimit - results.length;
    const excludeIds = [
      ...objectIds,
      ...results.map((r) => new mongoose.Types.ObjectId(r._id)),
    ];

    const additional = await User.find({
      ...match,
      _id: { $nin: excludeIds },
    })
      .select("_id displayName userName avatarUrl role status")
      .limit(additionalLimit)
      .lean();

    results = [...results, ...additional];
  }

  return results;
};

export const searchDiscoverableUsers = async ({
  excludedIds = [],
  regex,
  limit = 10,
}) => {
  const normalizedLimit = Math.max(1, Math.min(limit, 20));

  return User.find({
    ...buildBaseMatch(excludedIds),
    $or: [{ userName: regex }, { displayName: regex }],
  })
    .select("_id displayName userName avatarUrl role status")
    .limit(normalizedLimit)
    .lean();
};
