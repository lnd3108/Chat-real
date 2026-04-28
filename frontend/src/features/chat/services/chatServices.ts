import { ChatService } from "@/features/chat/application/ChatService";
import { ChatApiRepository } from "@/features/chat/data/ChatApiRepository";

export const chatServices = new ChatService(new ChatApiRepository());
