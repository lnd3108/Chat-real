import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { UserPlus } from "lucide-react";
import type { User } from "@/types/user";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import SearchForm from "../addFriendModals/SearchForm";
import SendFriendRequest from "../addFriendModals/SendFriendRequest";
import { useFriendStore } from "@/stores/useFriendStore";

export interface IFormValues {
  userName: string;
  message: string;
}

const AddFriendModal = () => {
  const [isFound, setIsFound] = useState<boolean | null>(null);
  const [searchUser, setSerchUser] = useState<User>();
  const [searchedUserName, setSearchedUserName] = useState("");
  const { loading, searchByUserName, addFriend } = useFriendStore();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<IFormValues>({
    defaultValues: { userName: "", message: "" },
  });

  const usernameValue = watch("userName");

  const handleSearch = handleSubmit(async (data) => {
    const userName = (data.userName ?? "").trim();
    if (!userName) return;

    setIsFound(null);

    setSearchedUserName(userName);

    try {
      const foundUser = await searchByUserName(userName);
      if (foundUser) {
        setIsFound(true);
        setSerchUser(foundUser);
      } else {
        setIsFound(false);
      }
    } catch (error) {
      console.error(error);
      setIsFound(false);
    }
  });

  const handleSend = handleSubmit(async (data) => {
    if (!searchUser) return;

    try {
      const message = await addFriend(
        searchUser._id,
        (data.message ?? "").trim()
      );
      toast.success(message);

      handleCancel();
    } catch (error) {
      console.error("Lỗi xảy ra khi gửi request từ form", error);
    }
  });

  const handleCancel = () => {
    reset();
    setSearchedUserName("");
    setIsFound(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex justify-center items-center size-5 rounded-full hover:bg-sidebar-accent cursor-pointer z-10">
          <UserPlus className="size-4" />
          <span className="sr-only">Kết bạn</span>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-none">
        <DialogHeader>
          <DialogTitle>Kết bạn</DialogTitle>
        </DialogHeader>

        {!isFound && (
          <>
            <SearchForm
              register={register}
              errors={errors}
              usernameValue={usernameValue}
              loading={loading}
              isFound={isFound}
              searchedUsername={searchedUserName}
              onSubmit={handleSearch}
              onCancel={handleCancel}
            />
          </>
        )}

        {isFound && (
          <>
            <SendFriendRequest
              register={register}
              loading={loading}
              searchedUsername={searchedUserName}
              onSubmit={handleSend}
              onBack={() => setIsFound(null)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
