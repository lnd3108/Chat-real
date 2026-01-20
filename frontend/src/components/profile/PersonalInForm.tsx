import type { User } from "@/types/user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Heart, Save } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/useAuthStore";

type EditableField = {
  key: keyof Pick<User, "displayName" | "userName" | "email" | "phone">;
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

type FormState = {
  displayName: string;
  userName: string;
  email: string;
  phone: string;
  bio: string;
};

const PersonalInForm = ({ userInfo }: Props) => {
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState<FormState>({
    displayName: "",
    userName: "",
    email: "",
    phone: "",
    bio: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userInfo) return;

    setForm({
      displayName: userInfo.displayName ?? "",
      userName: userInfo.userName ?? "",
      email: userInfo.email ?? "",
      phone: userInfo.phone ?? "",
      bio: userInfo.bio ?? "",
    });
  }, [userInfo]);

  const isChanged = useMemo(() => {
    if (!userInfo) return false;
    return (
      form.displayName !== (userInfo.displayName ?? "") ||
      form.userName !== (userInfo.userName ?? "") ||
      form.email !== (userInfo.email ?? "") ||
      form.phone !== (userInfo.phone ?? "") ||
      form.bio !== (userInfo.bio ?? "")
    );
  }, [form, userInfo]);

  if (!userInfo) return null;

  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setMsg(null);
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleSave = async () => {
    setLoading(true);
    setMsg(null);

    try {
      const payload = {
        displayName: form.displayName,
        userName: form.userName,
        email: form.email,
        phone: form.phone.trim() === "" ? null : form.phone,
        bio: form.bio.trim() === "" ? null : form.bio,
      };

      const res = await api.patch("/users/me", payload);

      if (res.data?.user) {
        setUser(res.data.user);
      }

      toast.success(res.data?.message || "Cập nhật thành công ✅");
      setMsg(res.data?.message || "Cập nhật thành công ✅");

      // await fetchMe();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? "Cập nhật thất bại, thử lại!";
      console.error("Failed to update user info:", err);
      toast.error(message);
      setMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thông Tin Cá Nhân
        </CardTitle>
        <CardDescription>
          Quản lý thông tin cá nhân của bạn như tên, email và số điện thoại.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAL_FIELDS.map(({ key, label, type }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={type ?? "text"}
                value={form[key] ?? ""}
                onChange={handleChange(key)}
                className="glass-light border-border/30"
              />
            </div>
          ))}
        </div>

        {/* bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Giới thiệu</Label>
          <Textarea
            id="bio"
            rows={3}
            value={form.bio}
            onChange={handleChange("bio")}
            className="glass-light border-border/30 resize-none"
          />
        </div>

        {/* message */}
        {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

        <Button
          disabled={!isChanged || loading}
          onClick={handleSave}
          className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity"
        >
          <Save className="size-4 mr-2" />
          {loading ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PersonalInForm;
