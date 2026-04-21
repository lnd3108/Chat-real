import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { normalizeRoles } from "./rbacService.js";

export const AUDIT_ACTIONS = {
  USER_ROLE_UPDATED: "USER_ROLE_UPDATED",
};

export const createAuditLog = async ({
  actorId,
  actorRoles = [],
  targetUserId,
  action,
  beforeData = null,
  afterData = null,
  reason = null,
  metadata = null,
}) =>
  AuditLog.create({
    actorId,
    actorRoles,
    targetUserId,
    action,
    beforeData,
    afterData,
    reason,
    metadata,
  });

export const listAuditLogs = async ({
  page = 1,
  limit = 20,
  actorUserId,
  targetUserId,
  actorQ = "",
  targetQ = "",
  from,
  to,
  action,
}) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (actorUserId) {
    query.actorId = actorUserId;
  }

  if (targetUserId) {
    query.targetUserId = targetUserId;
  }

  if (action) {
    query.action = action;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) {
      query.createdAt.$gte = new Date(from);
    }
    if (to) {
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  if (actorQ || targetQ) {
    const userQuery = [];

    if (actorQ) {
      userQuery.push({
        key: "actorId",
        q: actorQ,
      });
    }

    if (targetQ) {
      userQuery.push({
        key: "targetUserId",
        q: targetQ,
      });
    }

    for (const item of userQuery) {
      const regex = new RegExp(String(item.q).trim(), "i");
      const users = await User.find({
        $or: [{ userName: regex }, { displayName: regex }, { email: regex }],
      })
        .select("_id")
        .lean();

      query[item.key] = { $in: users.map((user) => user._id) };
    }
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("actorId", "displayName userName email avatarUrl role roles")
      .populate("targetUserId", "displayName userName email avatarUrl role roles")
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      actor: log.actorId
        ? {
            ...log.actorId,
            roles: normalizeRoles(log.actorId),
          }
        : null,
      targetUser: log.targetUserId
        ? {
            ...log.targetUserId,
            roles: normalizeRoles(log.targetUserId),
          }
        : null,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};
