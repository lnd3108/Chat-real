import { useEffect, useState } from "react";
import { ShieldBan } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useFriendStore } from "@/stores/useFriendStore";
import type { Friend } from "@/types/user";

import BlockTab, { type BlockedUser } from "./BlockTab";
import ReportTab, { type ReportPayload } from "./ReportTab";
import type { FriendItem } from "./SuggestUserInput";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

type FriendLike = Friend & {
  userId?: Partial<Friend>;
  friendId?: Partial<Friend>;
};

const STORAGE_BLOCKED_KEY = "chat_blocked_users";
const STORAGE_REPORTS_KEY = "chat_reports";

const normalizeFriend = (friend: FriendLike): FriendItem => {
  const user = friend.userId ?? friend.friendId ?? friend;

  return {
    _id: user._id || friend._id,
    userName: user.userName || friend.userName || "",
    displayName: user.displayName || friend.displayName || "",
    avatarUrl: user.avatarUrl || friend.avatarUrl,
  };
};

const getBlockedUsers = (): BlockedUser[] => {
  try {
    const raw = localStorage.getItem(STORAGE_BLOCKED_KEY);
    return raw ? (JSON.parse(raw) as BlockedUser[]) : [];
  } catch {
    return [];
  }
};

const BlockReportDialog = ({ open, setOpen }: Props) => {
  const [tab, setTab] = useState<"block" | "report">("block");
  const { friends, getFriends } = useFriendStore();

  const [blocked, setBlockedState] = useState<BlockedUser[]>(getBlockedUsers);
  const [blockUserName, setBlockUserName] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [report, setReport] = useState<ReportPayload>({
    targetUserName: "",
    reason: "Spam",
    description: "",
  });

  const friendList: FriendItem[] = (friends || [])
    .map((friend) => normalizeFriend(friend as FriendLike))
    .filter((friend) => friend.userName && friend.displayName);

  useEffect(() => {
    if (!open) return;
    void getFriends();
  }, [open, getFriends]);

  const setBlocked = (next: BlockedUser[]) => {
    setBlockedState(next);
    localStorage.setItem(STORAGE_BLOCKED_KEY, JSON.stringify(next));
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      setTab("block");
      setBlockedState(getBlockedUsers());
    }
  };

  const onSendReport = () => {
    try {
      const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
      const list = raw ? (JSON.parse(raw) as Array<ReportPayload & { createdAt: string }>) : [];
      list.push({
        ...report,
        targetUserName: report.targetUserName.trim(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(list));

      toast.success("Da gui bao cao");
      setReport({
        targetUserName: "",
        reason: "Spam",
        description: "",
      });
      setTab("block");
    } catch {
      toast.error("Gui bao cao that bai, thu lai.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-primary" />
            Chan va Bao cao
          </DialogTitle>
          <DialogDescription>
            Chan nguoi dung de khong nhan tin nhan hoac bao cao hanh vi xau
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "block" | "report")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="block">Chan</TabsTrigger>
            <TabsTrigger value="report">Bao cao</TabsTrigger>
          </TabsList>

          <TabsContent value="block">
            <BlockTab
              friends={friendList}
              blocked={blocked}
              setBlocked={setBlocked}
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
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default BlockReportDialog;
