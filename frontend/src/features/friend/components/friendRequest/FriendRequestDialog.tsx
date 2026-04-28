import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { getErrorMeta, logger } from "@/shared/lib/logger";
import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import ReceivedRequests from "@/features/friend/components/friendRequest/ReceivedRequests";
import SentRequest from "@/features/friend/components/friendRequest/SentRequest";

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

  useEffect(() => {
    if (!open) return;

    const loadRequest = async () => {
      try {
        await getAllFriendRequests();
      } catch (error) {
        logger.error("Loi xay ra khi tai loi moi ket ban", getErrorMeta(error));
      }
    };

    void loadRequest();
  }, [open, getAllFriendRequests]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTab(defaultTab);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Loi moi ket ban</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "received" | "sent")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">Da nhan</TabsTrigger>
            <TabsTrigger value="sent">Da gui</TabsTrigger>
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
