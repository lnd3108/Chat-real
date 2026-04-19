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
      const result = await friendService.sendFriendRequest(to, message);

      set((state) => ({
        friends:
          result.autoAccepted && result.newFriend
            ? state.friends.some((friend) => friend._id === result.newFriend?._id)
              ? state.friends
              : [result.newFriend, ...state.friends]
            : state.friends,
        suggestions: state.suggestions.map((user) =>
          user._id === to
            ? {
                ...user,
                isFriend: result.autoAccepted,
                requestSent: !result.autoAccepted,
                requestReceived: false,
              }
            : user,
        ),
        receivedList: result.matchedRequestId
          ? state.receivedList.filter((request) => request._id !== result.matchedRequestId)
          : state.receivedList,
        sentList: result.request
          ? state.sentList.some((request) => request._id === result.request?._id)
            ? state.sentList
            : [result.request, ...state.sentList]
          : state.sentList.filter((request) => request.to?._id !== to),
      }));

      if (result.matchedRequestId) {
        useNotificationStore.getState().removeNotificationByEntity(result.matchedRequestId);
      }

      return result;
    } catch (error) {
      console.error("Loi xay ra khi addFriend", error);
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data
          ?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;

      return {
        success: false,
        message: apiMessage ?? "Loi xay ra khi gui ket ban. Hay thu lai!",
        autoAccepted: false,
        newFriend: null,
        request: null,
      };
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
      const newFriend = await friendService.acceptRequest(requestId);

      set((state) => ({
        friends:
          newFriend && !state.friends.some((friend) => friend._id === newFriend._id)
            ? [newFriend, ...state.friends]
            : state.friends,
        receivedList: state.receivedList.filter((request) => request._id !== requestId),
        suggestions: newFriend
          ? state.suggestions.map((user) =>
              user._id === newFriend._id
                ? {
                    ...user,
                    isFriend: true,
                    requestSent: false,
                    requestReceived: false,
                  }
                : user,
            )
          : state.suggestions,
      }));
      useNotificationStore.getState().removeNotificationByEntity(requestId);
    } catch (error) {
      console.error("Loi xay ra khi acceptRequest", error);
      throw error;
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

  removeFriend: async (targetUserId) => {
    try {
      set({ loading: true });
      const result = await friendService.removeFriend(targetUserId);

      set((state) => ({
        friends: state.friends.filter((friend) => friend._id !== targetUserId),
        suggestions: state.suggestions.map((user) =>
          user._id === targetUserId
            ? {
                ...user,
                isFriend: false,
                requestSent: false,
                requestReceived: false,
              }
            : user,
        ),
        receivedList: state.receivedList.filter((request) => request.from?._id !== targetUserId),
        sentList: state.sentList.filter((request) => request.to?._id !== targetUserId),
      }));

      return result.message ?? "Đã hủy kết bạn";
    } catch (error) {
      console.error("Loi xay ra khi removeFriend", error);
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
