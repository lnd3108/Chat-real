import CallLayer from "@/features/chat/calls/components/CallLayer";
import ChatWindowLayout from "@/features/chat/components/ChatWindowLayout";
import { AppSidebar } from "@/features/chat/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/shared/ui/sidebar";

const ChatAppPage = () => {
  return (
    <SidebarProvider className="app-shell-bg h-dvh min-h-0 overflow-hidden">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-2">
        <ChatWindowLayout />
      </div>
      <CallLayer />
    </SidebarProvider>
  );
};

export default ChatAppPage;
