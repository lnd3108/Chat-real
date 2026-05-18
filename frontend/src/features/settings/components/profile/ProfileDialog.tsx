import type { Dispatch, SetStateAction } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import ProfileCard from "@/features/settings/components/profile/ProfileCard";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import PersonalInForm from "@/features/settings/components/profile/PersonalInForm";
import PreferencesForm from "@/features/settings/components/profile/PreferencesForm";
import PrivacySetting from "@/features/settings/components/profile/PrivacySetting";
import { useProfileSettingsStore } from "@/features/settings/stores/useProfileSettingsStore";
import { toast } from "sonner";

interface ProfileDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const ProfileDialog = ({ open, setOpen }: ProfileDialogProps) => {
  const { user } = useAuthStore();
  const { mode, cancelPendingVerification, reset } = useProfileSettingsStore();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (mode === "verify_email_change") {
        void cancelPendingVerification().then((result) => {
          if (!result.ok) {
            toast.error(result.message);
          }
        });
      }

      reset();
    }

    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,72rem)] overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-none">
        <div className="bg-gradient-glass">
          <DialogTitle className="sr-only">Hồ sơ và cài đặt</DialogTitle>

          <div className="mx-auto max-w-5xl p-4 sm:p-5 lg:p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-foreground">Hồ sơ và cài đặt</h1>
            </div>

            <div className="app-scrollbar-thin max-h-[calc(92vh-4rem)] overflow-y-auto pr-1">
              <ProfileCard user={user} />

              <Tabs className="my-4" defaultValue="personal">
                <TabsList className="glass-light grid h-auto w-full grid-cols-3 gap-2 p-1">
                  <TabsTrigger
                    value="personal"
                    className="min-w-0 data-[state=active]:glass-strong"
                  >
                    Tài khoản
                  </TabsTrigger>
                  <TabsTrigger
                    value="preferences"
                    className="min-w-0 data-[state=active]:glass-strong"
                  >
                    Tùy chỉnh
                  </TabsTrigger>
                  <TabsTrigger
                    value="privacy"
                    className="min-w-0 data-[state=active]:glass-strong"
                  >
                    Bảo mật
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="mt-4">
                  <PersonalInForm userInfo={user} />
                </TabsContent>

                <TabsContent value="preferences" className="mt-4">
                  <PreferencesForm />
                </TabsContent>

                <TabsContent value="privacy" className="mt-4">
                  <PrivacySetting />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
