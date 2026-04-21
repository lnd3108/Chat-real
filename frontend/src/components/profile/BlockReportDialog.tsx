import { useEffect, useState } from "react";
import { ShieldBan } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMeta, logger } from "@/lib/logger";
import { reportService } from "@/services/reportService";
import { userService } from "@/services/userService";
import { useFriendStore } from "@/stores/useFriendStore";
import type { BlockedUser, Friend } from "@/types/user";

import BlockTab from "./BlockTab";
import ReportTab, { type ReportPayload } from "./ReportTab";
import type { FriendItem } from "./SuggestUserInput";

type Props = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

type FriendLike = Friend & {
  userId?: Partial<Friend>;
  friendId?: Partial<Friend>;
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
    avatarUrl: user.avatarUrl || friend.avatarUrl,
  };
};

const BlockReportDialog = ({ open, setOpen }: Props) => {
  const [tab, setTab] = useState<"block" | "report">("block");
  const [blocked, setBlockedState] = useState<BlockedUser[]>([]);
  const [blockUserName, setBlockUserName] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [report, setReport] = useState<ReportPayload>(defaultReportState);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const { friends, getFriends } = useFriendStore();

  const friendList: FriendItem[] = (friends || [])
    .map((friend) => normalizeFriend(friend as FriendLike))
    .filter((friend) => friend.userName && friend.displayName);

  useEffect(() => {
    if (!open) {
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
  }, [open, getFriends]);

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

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
      toast.error("Gửi báo cáo thất bại, thử lại.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[85vh] overflow-y-auto border-border/30 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-primary" />
            Chặn và Báo cáo
          </DialogTitle>
          <DialogDescription>
            Chặn người dùng để ngừng nhắn tin direct hoặc gửi báo cáo hành vi xấu.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};

export default BlockReportDialog;
