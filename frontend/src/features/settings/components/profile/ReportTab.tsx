import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

import SuggestUserInput, { type FriendItem } from "@/features/settings/components/profile/SuggestUserInput";

export type ReportPayload = {
  targetUserId?: string;
  targetUserName: string;
  reason: string;
  description: string;
};

type Props = {
  friends: FriendItem[];
  report: ReportPayload;
  setReport: (next: ReportPayload) => void;
  onSendReport: () => void | Promise<void>;
  isSubmitting?: boolean;
};

const reasons = ["Spam", "Quấy rối", "Nội dung xấu", "Giả mạo", "Khác"];

const ReportTab = ({
  friends,
  report,
  setReport,
  onSendReport,
  isSubmitting = false,
}: Props) => {
  const handleSend = () => {
    if (!report.targetUserName.trim()) {
      toast.error("Nhập username cần báo cáo.");
      return;
    }

    if (!report.targetUserId) {
      toast.error("Chọn đúng người dùng từ danh sách gợi ý.");
      return;
    }

    if (!report.description.trim()) {
      toast.error("Nhập mô tả báo cáo.");
      return;
    }

    void onSendReport();
  };

  return (
    <div className="mt-4 space-y-4">
      <SuggestUserInput
        label="Username cần báo cáo"
        value={report.targetUserName}
        setValue={(value) =>
          setReport({
            ...report,
            targetUserName: value,
            targetUserId:
              friends.find((friend) => friend.userName === value.trim())?._id ??
              undefined,
          })
        }
        placeholder="Ví dụ: leminh"
        friends={friends}
      />

      <div className="space-y-2">
        <Label>Lý do</Label>
        <div className="flex flex-wrap gap-2">
          {reasons.map((reason) => (
            <Button
              key={reason}
              type="button"
              variant={report.reason === reason ? "default" : "outline"}
              className={
                report.reason === reason
                  ? "bg-gradient-primary"
                  : "glass-light border-border/30"
              }
              onClick={() => setReport({ ...report, reason })}
              disabled={isSubmitting}
            >
              {reason}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mô tả</Label>
        <Textarea
          value={report.description}
          onChange={(event) =>
            setReport({ ...report, description: event.target.value })
          }
          placeholder="Mô tả chi tiết hành vi vi phạm..."
          className="glass-light min-h-24 border-border/30"
          disabled={isSubmitting}
        />
      </div>

      <Button className="w-full" onClick={handleSend} disabled={isSubmitting}>
        <Flag className="mr-2 h-4 w-4" />
        {isSubmitting ? "Đang gửi báo cáo..." : "Gửi báo cáo"}
      </Button>
    </div>
  );
};

export default ReportTab;
