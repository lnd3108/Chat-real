import { useThemeStore } from "@/stores/useThemeStore";
import { playClickSound } from "@/lib/sound";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Smile } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

type EmojiSelection = {
  native?: string;
};

interface EmojiPickerProps {
  onChange: (value: string) => void;
}

const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
  const { isDark } = useThemeStore();

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          playClickSound();
        }
      }}
    >
      <PopoverTrigger className="cursor-pointer">
        <Smile className="size-4" />
      </PopoverTrigger>

      <PopoverContent
        side="right"
        sideOffset={40}
        className="mb-12 border-none bg-transparent shadow-none drop-shadow-none"
      >
        <Picker
          theme={isDark ? "dark" : "light"}
          data={data}
          onEmojiSelect={(emoji: EmojiSelection) => {
            playClickSound();
            onChange(emoji.native ?? "");
          }}
          emojiSize={24}
        />
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
