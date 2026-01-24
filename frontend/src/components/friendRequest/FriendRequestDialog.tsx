import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFriendStore } from "@/stores/useFriendStore";
import SentRequest from "./SentRequest";
import ReceivedRequests from "./ReceivedRequests";

interface FriendRequestDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  defaultTab?: "received" | "sent";
}

const FriendRequestDialog = ({
  open,
  setOpen,
  defaultTab = "received",
}: FriendRequestDialogProps) => {
  const [tab, setTab] = useState<"received" | "sent">(defaultTab);
  const { getAllFriendRequests } = useFriendStore();

  // ✅ chỉ load khi mở dialog
  useEffect(() => {
    if (!open) return;

    // ✅ reset tab đúng UX mỗi lần mở
    setTab(defaultTab);

    const loadRequest = async () => {
      try {
        await getAllFriendRequests();
      } catch (error) {
        console.error("Lỗi xảy ra khi load requests", error);
      }
    };

    loadRequest();
  }, [open, defaultTab, getAllFriendRequests]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Lời mời kết bạn</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">Đã nhận</TabsTrigger>
            <TabsTrigger value="sent">Đã gửi</TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            <ReceivedRequests />
          </TabsContent>
          <TabsContent value="sent">
            <SentRequest />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default FriendRequestDialog;
