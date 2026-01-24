import { useState } from "react";
import { Shield, Bell, ShieldBan, KeyRound, Trash2 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import ChangePasswordDialog from "./ChangePasswordDialog";
import DeleteAccountDialog from "./DeleteAccountDialog";
import NotificationSettingsDialog from "./NotificationSettingsDialog"; // ✅ add

const PrivacySettings = () => {
  const [openChangePass, setOpenChangePass] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openNotiSetting, setOpenNotiSetting] = useState(false); // ✅ add

  return (
    <>
      <Card className="glass-strong border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quyền riêng tư & Bảo mật
          </CardTitle>
          <CardDescription>
            Quản lý cài đặt quyền riêng tư và bảo mật của bạn
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-warning"
              onClick={() => setOpenChangePass(true)}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Đổi mật khẩu
            </Button>

            {/* ✅ open notification setting */}
            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-info"
              onClick={() => setOpenNotiSetting(true)}
            >
              <Bell className="h-4 w-4 mr-2" />
              Cài đặt thông báo
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-destructive"
            >
              <ShieldBan className="size-4 mr-2" />
              Chặn & Báo cáo
            </Button>
          </div>

          <div className="pt-4 border-t border-border/30">
            <h4 className="font-medium mb-3 text-destructive">
              Khu vực nguy hiểm
            </h4>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setOpenDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Xoá tài khoản
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* dialogs */}
      <ChangePasswordDialog open={openChangePass} setOpen={setOpenChangePass} />
      <DeleteAccountDialog open={openDelete} setOpen={setOpenDelete} />

      {/* ✅ new dialog */}
      <NotificationSettingsDialog
        open={openNotiSetting}
        setOpen={setOpenNotiSetting}
      />
    </>
  );
};

export default PrivacySettings;
