import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { IFormValues } from "../chat/AddFriendModal";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { DialogClose, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Search } from "lucide-react";

interface SearchFormProps {
  register: UseFormRegister<IFormValues>;
  errors: FieldErrors<IFormValues>;
  loading: boolean;
  usernameValue: string;
  isFound: boolean | null;
  searchedUsername: string;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

const SearchForm = ({
  register,
  errors,
  usernameValue,
  loading,
  isFound,
  searchedUsername,
  onSubmit,
  onCancel,
}: SearchFormProps) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="userName" className="text-sm font-semibold">
          Tìm bằng UserName
        </Label>

        <Input
          id="userName"
          placeholder="Gõ tên UserName vào đây...."
          className="glass border-border/50 focus:border-primary/50 transition-smooth"
          {...register("userName", {
            required: "UserName không được bỏ trống",
          })}
        ></Input>

        {errors.userName && (
          <p className="text-sm text-destructive">{errors.userName.message}</p>
        )}

        {isFound === false && (
          <span className="error-message">
            Không tìm thấy
            <span className="font-semibold">@{searchedUsername}</span>
          </span>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            className="flex-1 glass hover:text-destructive"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </DialogClose>

        <Button
          type="submit"
          disabled={loading || !usernameValue?.trim()}
          className="flex-1 bg-gradient-chat text-white hover:opacity-90 transition-smooth"
        >
          {loading ? (
            <span>Đang Tìm...</span>
          ) : (
            <>
              <Search className="size-4 mr-2" /> Tìm
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default SearchForm;
