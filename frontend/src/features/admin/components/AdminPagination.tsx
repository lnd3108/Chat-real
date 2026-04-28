import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui/button";

interface AdminPaginationProps {
  page: number;
  pages: number;
  onPrevious: () => void;
  onNext: () => void;
}

const AdminPagination = ({
  page,
  pages,
  onPrevious,
  onNext,
}: AdminPaginationProps) => {
  if (pages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
      <div className="text-sm text-muted-foreground">
        Trang {page} / {pages}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={onPrevious}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Trước
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page === pages}
          onClick={onNext}
          className="gap-2"
        >
          Sau
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default AdminPagination;
