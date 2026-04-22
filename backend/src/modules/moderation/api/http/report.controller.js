import {
  createReportCommand,
  getMyReportsQuery,
} from "../../application/report-user.service.js";

export const createReport = async (req, res) => {
  try {
    const report = await createReportCommand({ user: req.user, body: req.body });

    return res.status(201).json({
      message: "Táº¡o bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data: { report },
    });
  } catch (error) {
    console.error("Loi khi tao bao cao:", error);
    return res.status(error?.status || 500).json({
      message: error?.message || "KhÃ´ng thá»ƒ táº¡o bÃ¡o cÃ¡o",
    });
  }
};

export const getMyReports = async (req, res) => {
  try {
    const data = await getMyReportsQuery({
      reporterId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      targetType: req.query.targetType,
    });

    return res.json({
      message: "Láº¥y danh sÃ¡ch bÃ¡o cÃ¡o thÃ nh cÃ´ng",
      data,
    });
  } catch (error) {
    console.error("Loi khi lay danh sach bao cao:", error);
    return res.status(error?.status || 500).json({
      message: error?.message || "KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch bÃ¡o cÃ¡o",
    });
  }
};
