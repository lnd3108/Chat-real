import { useState } from "react";
import { Shield, Bell, ShieldBan, KeyRound, Trash2 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

import ChangePasswordDialog from "@/features/settings/components/profile/ChangePasswordDialog";
import DeleteAccountDialog from "@/features/settings/components/profile/DeleteAccountDialog";
import NotificationSettingsDialog from "@/features/notification/components/NotificationSettingsDialog";
import BlockReportDialog from "@/features/settings/components/profile/BlockReportDialog";

const PrivacySettings = () => {
  const [openChangePass, setOpenChangePass] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openNotiSetting, setOpenNotiSetting] = useState(false);
  const [openBlockReport, setOpenBlockReport] = useState(false);

  return (
    <>
      <Card className="glass-strong border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quyền riêng tư và bảo mật
          </CardTitle>
          <CardDescription>
            Quản lý các tùy chọn bảo mật và quyền riêng tư của bạn
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="glass-light w-full justify-start border-border/30 hover:text-warning"
              onClick={() => setOpenChangePass(true)}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Đổi mật khẩu
            </Button>

            <Button
              variant="outline"
              className="glass-light w-full justify-start border-border/30 hover:text-info"
              onClick={() => setOpenNotiSetting(true)}
            >
              <Bell className="mr-2 h-4 w-4" />
              Cài đặt thông báo
            </Button>

            <Button
              variant="outline"
              className="glass-light w-full justify-start border-border/30 hover:text-destructive"
              onClick={() => setOpenBlockReport(true)}
            >
              <ShieldBan className="mr-2 size-4" />
              Chặn và báo cáo
            </Button>
          </div>

          <div className="border-border/30 pt-4">
            <h4 className="mb-3 font-medium text-destructive">Khu vực nguy hiểm</h4>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setOpenDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa tài khoản
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordDialog open={openChangePass} setOpen={setOpenChangePass} />
      <DeleteAccountDialog open={openDelete} setOpen={setOpenDelete} />
      <NotificationSettingsDialog
        open={openNotiSetting}
        setOpen={setOpenNotiSetting}
      />
      <BlockReportDialog open={openBlockReport} setOpen={setOpenBlockReport} />
    </>
  );
};

export default PrivacySettings;
