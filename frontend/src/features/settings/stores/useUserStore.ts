import { toast } from "sonner";
import { create } from "zustand";

import { getErrorMeta, logger } from "@/shared/lib/logger";
import { userService } from "@/features/settings/services/userService";
import type { UserState } from "@/shared/types/store";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";

export const useUserStore = create<UserState>(() => ({
  updateAvatarUrl: async (formData) => {
    try {
      const { user, setUser } = useAuthStore.getState();
      const data = await userService.UploadAvatar(formData);

      if (user) {
        setUser({
          ...user,
          avatarUrl: data.avatarUrl,
        });

        useChatStore.getState().fetchConversations();
      }
    } catch (error) {
      logger.error("Không thể tải ảnh đại diện lên", getErrorMeta(error));
      toast.error("Không thể cập nhật ảnh đại diện.");
    }
  },
}));
