import ChatWindowLayout from "@/features/chat/components/ChatWindowLayout";
import { AppSidebar } from "@/features/chat/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/shared/ui/sidebar";

const ChatAppPage = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex h-screen w-full p-2">
        <ChatWindowLayout />
      </div>
    </SidebarProvider>
  );
};

export default ChatAppPage;
