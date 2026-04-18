import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";
import { useNotificationStore } from "./useNotificationStore";

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  suggestions: [],
  loading: false,
  suggestionsLoading: false,
  searchLoading: false,
  receivedList: [],
  sentList: [],

  searchByUserName: async (userName) => {
    try {
      set({ loading: true });
      return await friendService.searchByUserName(userName);
    } catch (error) {
      console.error("Loi xay ra khi tim user bang userName", error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  searchUsers: async (query, limit = 10) => {
    try {
      set({ loading: true, searchLoading: true });
      return await friendService.searchUsers(query, limit);
    } catch (error) {
      console.error("Loi xay ra khi tim danh sach user", error);
      return [];
    } finally {
      set({ loading: false, searchLoading: false });
    }
  },

  getSuggestions: async (limit = 10) => {
    try {
      set({ loading: true, suggestionsLoading: true });
      const suggestions = await friendService.getSuggestions(limit);
      set({ suggestions });
      return suggestions;
    } catch (error) {
      console.error("Loi xay ra khi lay goi y user", error);
      set({ suggestions: [] });
      return [];
    } finally {
      set({ loading: false, suggestionsLoading: false });
    }
  },

  markRequestSent: (userId) =>
    set((state) => ({
      suggestions: state.suggestions.map((user) =>
        user._id === userId ? { ...user, requestSent: true, requestReceived: false } : user,
      ),
    })),

  addFriend: async (to, message) => {
    try {
      set({ loading: true });
      const resultMessage = await friendService.sendFriendRequest(to, message);

      set((state) => ({
        suggestions: state.suggestions.map((user) =>
          user._id === to ? { ...user, requestSent: true, requestReceived: false } : user,
        ),
      }));

      return resultMessage;
    } catch (error) {
      console.error("Loi xay ra khi addFriend", error);
      return "Loi xay ra khi gui ket ban. Hay thu lai!";
    } finally {
      set({ loading: false });
    }
  },

  getAllFriendRequests: async () => {
    try {
      set({ loading: true });
      const result = await friendService.getAllFriendRequest();

      if (!result) return;

      const { received, sent } = result;

      set({ receivedList: received, sentList: sent });
      useNotificationStore.getState().syncFriendRequestNotifications(received);
    } catch (error) {
      console.error("Loi xay ra khi getAllFriendRequests", error);
    } finally {
      set({ loading: false });
    }
  },

  acceptRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.acceptRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((request) => request._id !== requestId),
      }));
      useNotificationStore.getState().removeNotificationByEntity(requestId);
    } catch (error) {
      console.error("Loi xay ra khi acceptRequest", error);
    } finally {
      set({ loading: false });
    }
  },

  declineRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.declineRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((request) => request._id !== requestId),
      }));
      useNotificationStore.getState().removeNotificationByEntity(requestId);
    } catch (error) {
      console.error("Loi xay ra khi declineRequest", error);
    } finally {
      set({ loading: false });
    }
  },

  cancelSentRequest: async (requestId, targetUserId) => {
    try {
      set({ loading: true });
      await friendService.cancelRequest(requestId);

      set((state) => ({
        sentList: state.sentList.filter((request) => request._id !== requestId),
        suggestions: targetUserId
          ? state.suggestions.map((user) =>
              user._id === targetUserId
                ? { ...user, requestSent: false, requestReceived: false }
                : user,
            )
          : state.suggestions,
      }));
    } catch (error) {
      console.error("Loi xay ra khi cancelSentRequest", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();
      set({ friends });
    } catch (error) {
      console.error("Loi xay ra khi load Friends", error);
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },
}));
