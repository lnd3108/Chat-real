import { shouldStoreNotification } from "@/features/notification/lib/messageNotifications";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useFriendStore } from "@/features/friend/stores/useFriendStore";
import { useNotificationStore } from "@/features/notification/stores/useNotificationStore";
import type { Socket } from "socket.io-client";

export class FriendSocketHandler {
  register(socket: Socket) {
    this.unregister(socket);
    socket.on("friend:request:received", this.handleRequestReceived);
    socket.on("friend:request:sent", this.handleRequestSent);
    socket.on("friend:request:accepted", this.handleRequestAccepted);
    socket.on("friend:request:removed", this.handleRequestRemoved);
    socket.on("friend:removed", this.handleFriendRemoved);
  }

  unregister(socket: Socket) {
    socket.off("friend:request:received", this.handleRequestReceived);
    socket.off("friend:request:sent", this.handleRequestSent);
    socket.off("friend:request:accepted", this.handleRequestAccepted);
    socket.off("friend:request:removed", this.handleRequestRemoved);
    socket.off("friend:removed", this.handleFriendRemoved);
  }

  private handleRequestReceived = ({ request }: any) => {
    if (!request?._id || !request?.from?._id) return;

    useFriendStore.setState((state) => ({
      receivedList: state.receivedList.some((item) => item._id === request._id)
        ? state.receivedList
        : [request, ...state.receivedList],
      suggestions: state.suggestions.map((user) =>
        user._id === request.from._id
          ? {
              ...user,
              isFriend: false,
              requestSent: false,
              requestReceived: true,
            }
          : user,
      ),
    }));

    if (shouldStoreNotification("friend_request")) {
      useNotificationStore.getState().addNotification({
        id: `friend-request-${request._id}`,
        type: "friend_request",
        title: "Lời mời kết bạn mới",
        message: `${request.from.displayName ?? "Ai đó"} đã gửi lời mời kết bạn cho bạn`,
        actorName: request.from.displayName,
        entityId: request._id,
        createdAt: request.createdAt,
      });
    }
  };

  private handleRequestSent = ({ request }: any) => {
    if (!request?._id || !request?.to?._id) return;

    useFriendStore.setState((state) => ({
      sentList: state.sentList.some((item) => item._id === request._id)
        ? state.sentList
        : [request, ...state.sentList],
      suggestions: state.suggestions.map((user) =>
        user._id === request.to._id
          ? {
              ...user,
              isFriend: false,
              requestSent: true,
              requestReceived: false,
            }
          : user,
      ),
    }));
  };

  private handleRequestAccepted = ({ requestId, userA, userB }: any) => {
    const currentUserId = useAuthStore.getState().user?._id;
    if (!currentUserId || !userA?._id || !userB?._id) return;

    const otherUser = userA._id === currentUserId ? userB : userA;
    if (!otherUser?._id) return;

    useFriendStore.setState((state) => ({
      friends: state.friends.some((friend) => friend._id === otherUser._id)
        ? state.friends
        : [otherUser, ...state.friends],
      suggestions: state.suggestions.map((user) =>
        user._id === otherUser._id
          ? {
              ...user,
              isFriend: true,
              requestSent: false,
              requestReceived: false,
            }
          : user,
      ),
      receivedList: state.receivedList.filter(
        (request) =>
          request._id !== requestId && request.from?._id !== otherUser._id,
      ),
      sentList: state.sentList.filter(
        (request) =>
          request._id !== requestId && request.to?._id !== otherUser._id,
      ),
    }));

    useNotificationStore.getState().removeNotificationByEntity(requestId);
  };

  private handleRequestRemoved = ({ requestId, fromUserId, toUserId }: any) => {
    const currentUserId = useAuthStore.getState().user?._id;
    if (!currentUserId) return;

    const otherUserId = currentUserId === fromUserId ? toUserId : fromUserId;
    if (!otherUserId) return;

    useFriendStore.setState((state) => ({
      receivedList: state.receivedList.filter((request) => request._id !== requestId),
      sentList: state.sentList.filter((request) => request._id !== requestId),
      suggestions: state.suggestions.map((user) =>
        user._id === otherUserId
          ? {
              ...user,
              isFriend: false,
              requestSent: false,
              requestReceived: false,
            }
          : user,
      ),
    }));

    useNotificationStore.getState().removeNotificationByEntity(requestId);
  };

  private handleFriendRemoved = ({ userId, targetUserId }: any) => {
    const currentUserId = useAuthStore.getState().user?._id;
    if (!currentUserId) return;

    const removedFriendId = userId === currentUserId ? targetUserId : userId;
    if (!removedFriendId) return;

    useFriendStore.setState((state) => ({
      friends: state.friends.filter((friend) => friend._id !== removedFriendId),
      suggestions: state.suggestions.map((user) =>
        user._id === removedFriendId
          ? {
              ...user,
              isFriend: false,
              requestSent: false,
              requestReceived: false,
            }
          : user,
      ),
      receivedList: state.receivedList.filter(
        (request) => request.from?._id !== removedFriendId,
      ),
      sentList: state.sentList.filter(
        (request) => request.to?._id !== removedFriendId,
      ),
    }));
  };
}
