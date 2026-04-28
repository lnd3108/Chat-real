import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

import { getErrorMeta, logger } from "@/shared/lib/logger";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { Button } from "@/shared/ui/button";

const Logout = () => {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      logger.error("Khong the dang xuat", getErrorMeta(error));
    }
  };

  return (
    <Button variant="completeGhost" onClick={handleLogout}>
      <LogOut className="text-destructive" />
      Logout
    </Button>
  );
};

export default Logout;
