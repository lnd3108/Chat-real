import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type FriendItem = {
  _id?: string;
  userName: string;
  displayName: string;
  avatarUrl?: string;
};

type Props = {
  label: string;
  value: string;
  setValue: (v: string) => void;
  placeholder?: string;
  friends: FriendItem[];
};

const SuggestUserInput = ({
  label,
  value,
  setValue,
  placeholder,
  friends,
}: Props) => {
  const [open, setOpen] = useState(false);

  const filteredFriends = useMemo(() => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) return friends;

    return friends.filter((f) => {
      const u = f?.userName?.toLowerCase() || "";
      const d = f?.displayName?.toLowerCase() || "";
      return u.includes(keyword) || d.includes(keyword);
    });
  }, [value, friends]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div>
            <Input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (friends.length > 0) setOpen(true);
              }}
              placeholder={placeholder}
              className="glass-light border-border/30"
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          // ✅ ĐẸP + RÕ: dùng bg-popover thay vì glass-strong (đỡ mờ/xấu)
          className="z-50 w-[--radix-popover-trigger-width] p-2 rounded-xl border bg-popover text-popover-foreground shadow-xl"
        >
          {friends.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-2">
              Bạn chưa có bạn bè để gợi ý.
            </p>
          )}

          {friends.length > 0 && filteredFriends.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-2">
              Không tìm thấy bạn bè phù hợp
            </p>
          )}

          {filteredFriends.length > 0 && (
            <div className="max-h-56 overflow-auto">
              {filteredFriends.slice(0, 10).map((f) => {
                const active = f.userName === value.trim();

                return (
                  <button
                    key={f?._id || f.userName}
                    type="button"
                    // ✅ FIX CLICK 1 PHÁT ĂN: chặn blur/close trước khi click chạy
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setValue(f.userName);
                      setOpen(false);
                    }}
                    className={[
                      "w-full px-3 py-2 rounded-lg text-left flex items-center gap-3",
                      "transition select-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      active ? "bg-accent text-accent-foreground" : "",
                    ].join(" ")}
                  >
                    {/* avatar chữ cái */}
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                      {f.displayName?.[0]?.toUpperCase() || "U"}
                    </div>

                    <div className="flex flex-col flex-1">
                      <span className="font-medium leading-5">
                        {f.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{f.userName}
                      </span>
                    </div>

                    {active && <Check className="size-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SuggestUserInput;
