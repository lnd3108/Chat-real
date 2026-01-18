import type { User } from "@/types/user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Heart } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

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

const PersonalInForm = ({ userInfo }: Props) => {
  if (!userInfo) return;

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAL_FIELDS.map(({ key, label, type }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={type ?? "text"}
                value={userInfo[key] ?? ""}
                onChange={() => {}}
                className="glass-light border-border/30"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Giới thiệu</Label>
          <Textarea
            id="bio"
            rows={3}
            value={userInfo.bio ?? ""}
            onChange={() => {}}
            className="glass-light border-border/30 resize-none"
          />
        </div>

        <Button className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity">
          Lưu thay đổi
        </Button>
      </CardContent>
    </Card>
  );
};

export default PersonalInForm;
