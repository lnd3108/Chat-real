import { useEffect, useMemo, useState } from "react";
import { ShieldBan } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { getErrorMeta, logger } from "@/shared/lib/logger";
import { reportService } from "@/features/settings/services/reportService";
import { userService } from "@/features/settings/services/userService";
import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import type { BlockedUser, Friend } from "@/shared/types/user";

import BlockTab from "@/features/settings/components/profile/BlockTab";
import ReportTab, { type ReportPayload } from "@/features/settings/components/profile/ReportTab";
import type { FriendItem } from "@/features/settings/components/profile/SuggestUserInput";

type Props = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

type FriendLike = Friend & {
  avatar?: string | null;
  profilePicture?: string | null;
  photoURL?: string | null;
  userId?: Partial<Friend> & {
    avatar?: string | null;
    profilePicture?: string | null;
    photoURL?: string | null;
  };
  friendId?: Partial<Friend> & {
    avatar?: string | null;
    profilePicture?: string | null;
    photoURL?: string | null;
  };
};

const defaultReportState: ReportPayload = {
  targetUserId: undefined,
  targetUserName: "",
  reason: "Spam",
  description: "",
};

const normalizeFriend = (friend: FriendLike): FriendItem => {
  const user = friend.userId ?? friend.friendId ?? friend;

  return {
    _id: user._id || friend._id,
    userName: user.userName || friend.userName || "",
    displayName: user.displayName || friend.displayName || "",
    avatarUrl:
      user.avatarUrl ||
      user.avatar ||
      user.profilePicture ||
      user.photoURL ||
      friend.avatarUrl ||
      friend.avatar ||
      friend.profilePicture ||
      friend.photoURL ||
      undefined,
  };
};

type BlockReportPanelProps = {
  active?: boolean;
};

export const BlockReportPanel = ({ active = true }: BlockReportPanelProps) => {
  const [tab, setTab] = useState<"block" | "report">("block");
  const [blocked, setBlockedState] = useState<BlockedUser[]>([]);
  const [blockUserName, setBlockUserName] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [report, setReport] = useState<ReportPayload>(defaultReportState);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const { friends, getFriends } = useFriendStore();

  const friendList: FriendItem[] = useMemo(
    () =>
      (friends || [])
        .map((friend) => normalizeFriend(friend as FriendLike))
        .filter((friend) => friend.userName && friend.displayName),
    [friends],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    setTab("block");
    setBlockUserName("");
    setBlockReason("");
    setReport(defaultReportState);
    setIsSubmittingReport(false);

    void getFriends();
    void (async () => {
      try {
        setBlockedState(await userService.getBlockedUsers());
      } catch (error) {
        logger.error("Loi tai danh sach chan", getErrorMeta(error));
        toast.error("Không thể tải danh sách chặn.");
      }
    })();
  }, [active, getFriends]);

  const onSendReport = async () => {
    try {
      if (!report.targetUserId) {
        toast.error("Chọn đúng người dùng cần báo cáo.");
        return;
      }

      setIsSubmittingReport(true);

      const payload = {
        targetType: "user" as const,
        targetUserId: report.targetUserId,
        reason: report.reason,
        description: report.description.trim(),
      };

      await reportService.createReport(payload);

      toast.success("Đã gửi báo cáo");
      setReport(defaultReportState);
      setTab("block");
    } catch (error) {
      logger.error("Loi gui bao cao tu dialog quyen rieng tu", getErrorMeta(error));
      toast.error("Gửi báo cáo thất bại, vui lòng thử lại.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as "block" | "report")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="block">Chặn</TabsTrigger>
        <TabsTrigger value="report">Báo cáo</TabsTrigger>
      </TabsList>

      <TabsContent value="block">
        <BlockTab
          friends={friendList}
          blocked={blocked}
          setBlocked={setBlockedState}
          blockUserName={blockUserName}
          setBlockUserName={setBlockUserName}
          blockReason={blockReason}
          setBlockReason={setBlockReason}
        />
      </TabsContent>

      <TabsContent value="report">
        <ReportTab
          friends={friendList}
          report={report}
          setReport={setReport}
          onSendReport={onSendReport}
          isSubmitting={isSubmittingReport}
        />
      </TabsContent>
    </Tabs>
  );
};

const BlockReportDialog = ({ open, setOpen }: Props) => (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="glass-strong max-h-[85vh] overflow-hidden border-border/30 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-primary" />
          Chặn và báo cáo
        </DialogTitle>
        <DialogDescription>
          Chặn người dùng để ngừng nhắn tin direct hoặc gửi báo cáo hành vi xấu.
        </DialogDescription>
      </DialogHeader>

      <div className="app-scrollbar-thin overflow-y-auto pr-1">
        <BlockReportPanel active={open} />
      </div>
    </DialogContent>
  </Dialog>
);

export default BlockReportDialog;
