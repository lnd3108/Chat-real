import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import UserAvatar from "@/features/chat/components/UserAvatar";

export type FriendItem = {
  _id?: string;
  userName: string;
  displayName: string;
  avatarUrl?: string;
};

type Props = {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  friends: FriendItem[];
};

const DEFAULT_SUGGESTION_COUNT = 5;

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

    if (!keyword) {
      return friends.slice(0, DEFAULT_SUGGESTION_COUNT);
    }

    return friends.filter((friend) => {
      const userName = friend.userName?.toLowerCase() || "";
      const displayName = friend.displayName?.toLowerCase() || "";
      return userName.includes(keyword) || displayName.includes(keyword);
    });
  }, [friends, value]);

  const showSuggestions = open && friends.length > 0;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="relative">
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (friends.length > 0) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          className="glass-light border-border/30"
        />

        {showSuggestions ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-border/40 bg-popover p-2 text-popover-foreground shadow-xl">
            {filteredFriends.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                Không tìm thấy bạn bè phù hợp.
              </p>
            ) : (
              <div className="app-scrollbar-thin max-h-56 overflow-auto">
                {filteredFriends.slice(0, 10).map((friend) => {
                  const active = friend.userName === value.trim();

                  return (
                    <button
                      key={friend._id || friend.userName}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setValue(friend.userName);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left",
                        "select-none transition",
                        active
                          ? "border-primary/30 bg-primary/10 text-foreground"
                          : "border-transparent hover:border-border/50 hover:bg-muted/60",
                      )}
                    >
                      <UserAvatar
                        type="chat"
                        name={friend.displayName || friend.userName}
                        avatarUrl={friend.avatarUrl || undefined}
                        className="size-10 shrink-0 text-sm"
                      />

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium leading-5">
                          {friend.displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          @{friend.userName}
                        </span>
                      </div>

                      {active ? <Check className="size-4 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {open && friends.length === 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-border/40 bg-popover p-4 text-sm text-muted-foreground shadow-xl">
            Bạn chưa có bạn bè để gợi ý.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SuggestUserInput;
