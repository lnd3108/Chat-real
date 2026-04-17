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
      <DialogContent className="overflow-y-auto border-0 bg-transparent p-0 shadow-2xl">
        <div className="bg-gradient-glass">
          <DialogTitle className="sr-only">Hồ sơ và cài đặt</DialogTitle>

          <div className="mx-auto max-w-4xl p-4">
            <div className="mb-6">
              <h1 className="items-center text-2xl font-bold text-foreground">
                Hồ sơ và cài đặt
              </h1>
            </div>

            <ProfileCard user={user} />

            <Tabs className="my-4" defaultValue="personal">
              <TabsList className="glass-light grid w-full grid-cols-3">
                <TabsTrigger
                  value="personal"
                  className="data-[state=active]:glass-strong"
                >
                  Tài khoản
                </TabsTrigger>
                <TabsTrigger
                  value="preferences"
                  className="data-[state=active]:glass-strong"
                >
                  Tùy chỉnh
                </TabsTrigger>
                <TabsTrigger
                  value="privacy"
                  className="data-[state=active]:glass-strong"
                >
                  Bảo mật
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personal">
                <PersonalInForm userInfo={user} />
              </TabsContent>

              <TabsContent value="preferences">
                <PreferencesForm />
              </TabsContent>

              <TabsContent value="privacy">
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
