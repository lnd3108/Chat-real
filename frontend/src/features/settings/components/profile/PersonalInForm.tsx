import { useEffect, useMemo } from "react";
import type { User } from "@/shared/types/user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Heart, Mail, Save } from "lucide-react";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { toast } from "sonner";
import { useProfileSettingsStore } from "@/features/settings/stores/useProfileSettingsStore";
import VerifyNewEmailSection from "@/features/settings/components/profile/VerifyNewEmailSection";

type EditableField = {
  key: "displayName" | "userName" | "email" | "phone";
  label: string;
  type?: string;
};

const PERSONAL_FIELDS: EditableField[] = [
  { key: "displayName", label: "Tên hiển thị" },
  { key: "userName", label: "Tên người dùng" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Số điện thoại" },
];

type Props = {
  userInfo: User | null;
};

const PersonalInForm = ({ userInfo }: Props) => {
  const {
    mode,
    formValues,
    originalValues,
    isSaving,
    errorMessage,
    successMessage,
    initialize,
    setField,
    saveChanges,
  } = useProfileSettingsStore();

  useEffect(() => {
    initialize(userInfo);
  }, [initialize, userInfo]);

  const isChanged = useMemo(
    () =>
      formValues.displayName !== originalValues.displayName ||
      formValues.userName !== originalValues.userName ||
      formValues.email !== originalValues.email ||
      formValues.phone !== originalValues.phone ||
      formValues.bio !== originalValues.bio,
    [formValues, originalValues],
  );

  if (!userInfo) return null;

  const handleSave = async () => {
    const result = await saveChanges();
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thông tin cá nhân
        </CardTitle>
        <CardDescription className="leading-6">
          Quản lý tên hiển thị, tên người dùng, email, số điện thoại và giới thiệu của bạn.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PERSONAL_FIELDS.map(({ key, label, type }) => (
            <div key={key} className="min-w-0 space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={type ?? "text"}
                value={formValues[key] ?? ""}
                onChange={(event) => setField(key, event.target.value)}
                disabled={mode === "verify_email_change" && key === "email"}
                className="glass-light border-border/30"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Giới thiệu</Label>
          <Textarea
            id="bio"
            rows={4}
            value={formValues.bio}
            onChange={(event) => setField("bio", event.target.value)}
            className="glass-light min-h-28 resize-none border-border/30"
          />
        </div>

        {mode === "verify_email_change" ? <VerifyNewEmailSection /> : null}

        {successMessage ? <div className="text-sm text-muted-foreground">{successMessage}</div> : null}
        {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Button
            type="button"
            disabled={!isChanged || isSaving || mode === "verify_email_change"}
            onClick={() => void handleSave()}
            className="w-full bg-gradient-primary transition-opacity hover:opacity-90 sm:w-auto"
            loading={isSaving}
            loadingText="Đang lưu..."
          >
            <Save className="size-4" />
            Lưu thay đổi
          </Button>

          {mode === "verify_email_change" ? (
            <div className="flex min-w-0 items-start gap-2 text-sm leading-6 text-muted-foreground xl:max-w-md">
              <Mail className="mt-0.5 size-4 shrink-0" />
              <span>Email mới sẽ chỉ được cập nhật sau khi xác minh OTP.</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalInForm;
