import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="glass-light border-border/30"
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-2 glass-strong border-border/30"
        >
          {/* ✅ nếu chưa có bạn bè */}
          {friends.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-2">
              Bạn chưa có bạn bè để gợi ý.
            </p>
          )}

          {/* ✅ có bạn bè nhưng filter không ra */}
          {friends.length > 0 && filteredFriends.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-2">
              Không tìm thấy bạn bè phù hợp
            </p>
          )}

          {/* ✅ render list */}
          {filteredFriends.length > 0 && (
            <div className="max-h-56 overflow-auto">
              {filteredFriends.slice(0, 10).map((f) => {
                const active = f.userName === value.trim();
                return (
                  <button
                    key={f?._id || f.userName}
                    type="button"
                    onClick={() => {
                      setValue(f.userName);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-md text-left hover:bg-muted/30 flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{f.displayName}</span>
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
