import type { User } from "@/shared/types/user";
import { Card, CardContent } from "@/shared/ui/card";
import UserAvatar from "@/features/chat/components/UserAvatar";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { useSocketStore } from "@/shared/realtime/useSocketStore";
import AvatarUploader from "@/features/settings/components/profile/AvatarUploader";

interface ProfileCardProps {
  user: User | null;
}

const ProfileCard = ({ user }: ProfileCardProps) => {
  const { onlineUsers } = useSocketStore();

  if (!user) return null;

  const bio = user.bio?.trim() || "Người dùng này chưa cập nhật giới thiệu.";
  const isOnline = onlineUsers.includes(user._id);

  return (
    <Card className="overflow-hidden bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-0">
      <CardContent className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:p-6">
        <div className="relative shrink-0">
          <UserAvatar
            type="profile"
            name={user.displayName}
            avatarUrl={user.avatarUrl ?? undefined}
            className="shadow-lg ring-4 ring-white"
          />
          <AvatarUploader />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {user.displayName}
          </h1>

          <p className="mt-2 line-clamp-2 text-sm text-white/70">{bio}</p>
        </div>

        <Badge
          className={cn(
            "flex items-center gap-1 capitalize",
            isOnline
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-700",
          )}
        >
          <div
            className={cn(
              "size-2 rounded-full",
              isOnline ? "animate-pulse bg-green-500" : "bg-slate-500",
            )}
          />
          {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
        </Badge>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;
