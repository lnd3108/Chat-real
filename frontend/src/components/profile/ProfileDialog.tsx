import type { Dispatch, SetStateAction } from "react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import ProfileCard from "./ProfileCard";
import { useAuthStore } from "@/stores/useAuthStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import PersonalInForm from "./PersonalInForm";
import PreferencesForm from "./PreferencesForm";
import PrivacySetting from "./PrivacySetting";

interface ProfileDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const ProfileDialog = ({ open, setOpen }: ProfileDialogProps) => {
  const { user } = useAuthStore();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-y-auto p-0 bg-transparent border-0 shadow-2xl">
        <div className="bg-gradient-glass">
          <DialogTitle className="sr-only">Profile & Settings</DialogTitle>

          <div className="max-w-4xl mx-auto p-4 ">
            {/* heading */}
            <div className="mb-6">
              <h1 className="text-2xl items-center font-bold text-foreground">
                Profile & Settings
              </h1>
            </div>
            <ProfileCard user={user} />

            {/* tabs */}
            <Tabs className="my-4" defaultValue="personal">
              <TabsList className="grid w-full grid-cols-3 glass-light ">
                <TabsTrigger
                  value="personal"
                  className="data-[state=active]:glass-strong"
                >
                  Tài Khoản
                </TabsTrigger>
                <TabsTrigger
                  value="preferences"
                  className="data-[state=active]:glass-strong"
                >
                  Cấu Hình
                </TabsTrigger>
                <TabsTrigger
                  value="privacy"
                  className="data-[state=active]:glass-strong"
                >
                  Bảo Mật
                </TabsTrigger>
              </TabsList>
              <TabsContent value="personal">
                {/* <PersonalInForm /> */}
                <PersonalInForm userInfo={user} />
              </TabsContent>
              <TabsContent value="preferences">
                {/* <PreferencesForm /> */}
                <PreferencesForm />
              </TabsContent>
              <TabsContent value="privacy">
                {/* <PrivacySetting /> */}
                <PrivacySetting />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
