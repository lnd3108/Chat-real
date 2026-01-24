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

import BlockTab, { type BlockedUser } from "./BlockTab";
import ReportTab, { type ReportPayload } from "./ReportTab";
import type { FriendItem } from "./SuggestUserInput";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

const STORAGE_BLOCKED_KEY = "chat_blocked_users";
const STORAGE_REPORTS_KEY = "chat_reports";

const BlockReportDialog = ({ open, setOpen }: Props) => {
  const [tab, setTab] = useState<"block" | "report">("block");

  // friend store
  const { friends, getFriends } = useFriendStore() as any;

  // block state
  const [blocked, setBlockedState] = useState<BlockedUser[]>([]);
  const [blockUserName, setBlockUserName] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // report state
  const [report, setReport] = useState<ReportPayload>({
    targetUserName: "",
    reason: "Spam",
    description: "",
  });

  const normalizeFriend = (f: any) => {
    // nhiều backend trả về friend.userId hoặc friend.friendId
    const u = f?.userId || f?.friendId || f;

    return {
      _id: u?._id || f?._id,
      userName: u?.userName || f?.userName || "",
      displayName: u?.displayName || f?.displayName || "",
      avatarUrl: u?.avatarUrl || f?.avatarUrl,
    };
  };

  const friendList: FriendItem[] = (friends || [])
    .map(normalizeFriend)
    .filter((x: FriendItem) => x.userName && x.displayName);

  // load when open
  useEffect(() => {
    if (!open) return;

    setTab("block");
    getFriends?.();

    // load blocked list
    try {
      const raw = localStorage.getItem(STORAGE_BLOCKED_KEY);
      setBlockedState(raw ? JSON.parse(raw) : []);
    } catch {
      setBlockedState([]);
    }
  }, [open, getFriends]);

  // save blocked to localStorage
  const setBlocked = (next: BlockedUser[]) => {
    setBlockedState(next);
    localStorage.setItem(STORAGE_BLOCKED_KEY, JSON.stringify(next));
  };

  // send report -> localStorage
  const onSendReport = () => {
    try {
      const raw = localStorage.getItem(STORAGE_REPORTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push({
        ...report,
        targetUserName: report.targetUserName.trim(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(list));

      toast.success("Đã gửi báo cáo ✅");
      setReport({
        targetUserName: "",
        reason: "Spam",
        description: "",
      });
      setTab("block");
    } catch {
      toast.error("Gửi báo cáo thất bại, thử lại nhé.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-strong border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-primary" />
            Chặn & Báo cáo
          </DialogTitle>
          <DialogDescription>
            Chặn người dùng để không nhận tin nhắn / báo cáo hành vi xấu
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="block">Chặn</TabsTrigger>
            <TabsTrigger value="report">Báo cáo</TabsTrigger>
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
