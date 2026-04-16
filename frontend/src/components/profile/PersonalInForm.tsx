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
import axios from "axios";

type EditableField = {
  key: keyof Pick<User, "displayName" | "userName" | "email" | "phone">;
  label: string;
  type?: string;
};

const PERSONAL_FIELDS: EditableField[] = [
  { key: "displayName", label: "Ten hien thi" },
  { key: "userName", label: "Ten nguoi dung" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "So dien thoai" },
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

      const message = res.data?.message || "Cap nhat thanh cong";
      toast.success(message);
      setMsg(message);
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Cap nhat that bai, thu lai!";
      console.error("Failed to update user info:", error);
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
          Thong Tin Ca Nhan
        </CardTitle>
        <CardDescription>
          Quan ly thong tin ca nhan cua ban nhu ten, email va so dien thoai.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <div className="space-y-2">
          <Label htmlFor="bio">Gioi thieu</Label>
          <Textarea
            id="bio"
            rows={3}
            value={form.bio}
            onChange={handleChange("bio")}
            className="glass-light resize-none border-border/30"
          />
        </div>

        {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

        <Button
          disabled={!isChanged || loading}
          onClick={handleSave}
          className="w-full bg-gradient-primary transition-opacity hover:opacity-90 md:w-auto"
        >
          <Save className="mr-2 size-4" />
          {loading ? "Dang luu..." : "Luu thay doi"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PersonalInForm;
