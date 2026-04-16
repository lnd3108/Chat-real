import { useState, useRef } from "react";
import { chatServices } from "@/services/chatServices";

interface MessageInputProps {
  conversationId: string;
}

export default function MessageInput({ conversationId }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate props
  if (!conversationId) {
    return <div className="error">Thiếu conversation ID</div>;
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) {
      setImage(null);
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Chỉ chấp nhận file hình ảnh");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh tối đa 5MB");
      return;
    }

    setImage(file);
  };

  const clearImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!content.trim() && !image) return;

    setLoading(true);
    setError(null);

    try {
      if (image) {
        // Send message with image using FormData
        const formData = new FormData();
        formData.append("conversationId", conversationId);
        if (content.trim()) formData.append("content", content.trim());
        formData.append("image", image);

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/messages/group/with-image`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Lỗi gửi ảnh");
        }

        const data = await response.json();
        console.log("Message sent:", data);
      } else {
        // Send text message using service
        await chatServices.sendGroupMessage(conversationId, content.trim());
      }

      // Clear form
      setContent("");
      clearImage();

      // Trigger message refresh (you might want to emit socket event or refresh store)
      // useChatStore.getState().fetchMessages(conversationId);
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
      setError(error instanceof Error ? error.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-input">
      {error && (
        <div
          className="error-message"
          style={{ color: "red", marginBottom: "8px" }}
        >
          {error}
        </div>
      )}

      {/* Image Preview */}
      {image && (
        <div className="image-preview" style={{ marginBottom: "8px" }}>
          <img
            src={URL.createObjectURL(image)}
            alt="Preview"
            style={{
              maxWidth: "200px",
              maxHeight: "200px",
              borderRadius: "8px",
            }}
          />
          <button
            type="button"
            onClick={clearImage}
            style={{ marginLeft: "8px", color: "red" }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Nhập tin nhắn..."
          style={{ flex: 1, minHeight: "40px", resize: "vertical" }}
          disabled={loading}
        />

        <label className="image-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            hidden
            disabled={loading}
          />
          <span style={{ cursor: loading ? "not-allowed" : "pointer" }}>
            📸 {image ? "Đổi ảnh" : "Chọn ảnh"}
          </span>
        </label>

        <button
          onClick={handleSend}
          disabled={loading || (!content.trim() && !image)}
          style={{
            padding: "8px 16px",
            opacity: loading || (!content.trim() && !image) ? 0.5 : 1,
          }}
        >
          {loading ? "🔄" : "📤"}
        </button>
      </div>
    </div>
  );
}
