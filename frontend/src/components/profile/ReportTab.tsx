import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import SuggestUserInput, { type FriendItem } from "./SuggestUserInput";

export type ReportPayload = {
  targetUserName: string;
  reason: string;
  description: string;
};

type Props = {
  friends: FriendItem[];
  report: ReportPayload;
  setReport: (next: ReportPayload) => void;
  onSendReport: () => void;
};

const reasons = ["Spam", "Quấy rối", "Nội dung xấu", "Giả mạo", "Khác"];

const ReportTab = ({ friends, report, setReport, onSendReport }: Props) => {
  const handleSend = () => {
    if (!report.targetUserName.trim()) {
      toast.error("Nhập username cần báo cáo.");
      return;
    }
    if (!report.description.trim()) {
      toast.error("Nhập mô tả báo cáo (ít nhất 1 câu).");
      return;
    }
    onSendReport();
  };

  return (
    <div className="mt-4 space-y-4">
      <SuggestUserInput
        label="Username cần báo cáo"
        value={report.targetUserName}
        setValue={(v) => setReport({ ...report, targetUserName: v })}
        placeholder="Ví dụ: leminh"
        friends={friends}
      />

      <div className="space-y-2">
        <Label>Lý do</Label>
        <div className="flex gap-2 flex-wrap">
          {reasons.map((r) => (
            <Button
              key={r}
              type="button"
              variant={report.reason === r ? "default" : "outline"}
              className={
                report.reason === r
                  ? "bg-gradient-primary"
                  : "glass-light border-border/30"
              }
              onClick={() => setReport({ ...report, reason: r })}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mô tả</Label>
        <Textarea
          value={report.description}
          onChange={(e) => setReport({ ...report, description: e.target.value })}
          placeholder="Mô tả chi tiết hành vi vi phạm..."
          className="glass-light border-border/30 min-h-24"
        />
      </div>

      <Button className="w-full" onClick={handleSend}>
        <Flag className="h-4 w-4 mr-2" />
        Gửi báo cáo
      </Button>
    </div>
  );
};

export default ReportTab;
