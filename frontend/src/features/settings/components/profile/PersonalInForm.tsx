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

  const handleCancel = () => {
    initialize(userInfo);
  };

  return (
    <Card className="app-surface border">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-background/50 text-primary">
            <Heart className="size-5" />
          </span>
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
              <Label htmlFor={key} className="text-sm font-medium text-foreground/85">
                {label}
              </Label>
              <Input
                id={key}
                type={type ?? "text"}
                value={formValues[key] ?? ""}
                onChange={(event) => setField(key, event.target.value)}
                disabled={mode === "verify_email_change" && key === "email"}
                className="h-11 rounded-xl border-white/45 bg-white/45 px-3.5 shadow-sm backdrop-blur-xl transition-all focus-visible:border-primary/45 focus-visible:ring-primary/20 dark:border-white/10 dark:bg-white/[0.045]"
              />
            </div>
          ))}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bio" className="text-sm font-medium text-foreground/85">
              Giới thiệu
            </Label>
            <Textarea
              id="bio"
              rows={4}
              value={formValues.bio}
              onChange={(event) => setField("bio", event.target.value)}
              className="min-h-24 resize-none rounded-xl border-white/45 bg-white/45 px-3.5 py-3 shadow-sm backdrop-blur-xl transition-all focus-visible:border-primary/45 focus-visible:ring-primary/20 dark:border-white/10 dark:bg-white/[0.045]"
            />
          </div>
        </div>

        {mode === "verify_email_change" ? <VerifyNewEmailSection /> : null}

        {successMessage ? <div className="text-sm text-muted-foreground">{successMessage}</div> : null}
        {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}

        {mode === "verify_email_change" ? (
          <div className="flex min-w-0 items-start gap-2 text-sm leading-6 text-muted-foreground">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <span>Email mới sẽ chỉ được cập nhật sau khi xác minh OTP.</span>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-white/45 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={!isChanged || isSaving || mode === "verify_email_change"}
            onClick={handleCancel}
            className="w-full border-white/45 bg-white/45 shadow-sm hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] sm:w-auto"
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={!isChanged || isSaving || mode === "verify_email_change"}
            onClick={() => void handleSave()}
            className="app-primary-gradient w-full border-0 text-slate-950 shadow-[0_14px_34px_-18px_rgba(167,139,250,0.95)] transition-all hover:opacity-95 hover:shadow-[0_18px_42px_-20px_rgba(244,114,182,0.95)] disabled:shadow-none dark:text-slate-950 sm:w-auto"
            loading={isSaving}
            loadingText="Đang lưu..."
          >
            <Save className="size-4" />
            Lưu thay đổi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalInForm;
