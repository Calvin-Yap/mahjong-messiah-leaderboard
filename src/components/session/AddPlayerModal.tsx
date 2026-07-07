"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import clsx from "clsx";

// emoji-picker-react touches `window` at import time, so it can only ever
// render on the client — dynamic-import it with ssr disabled rather than
// a plain top-level import, or Next.js's server render of this modal's
// parent tree would blow up.
const FullEmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <p className="py-6 text-center text-sm text-ink-400">
      Loading emoji picker…
    </p>
  ),
});

// Quick emoji list ported from buildAddPlayerDialog() in code.gs.
const QUICK_EMOJI = [
  "🌸",
  "🦊",
  "🚀",
  "🐉",
  "🎸",
  "🦅",
  "🌙",
  "⚡",
  "🧋",
  "🦁",
  "🌷",
  "🎯",
  "🐈",
  "💎",
  "🛹",
  "🌴",
  "🦋",
  "🔥",
  "🍀",
  "🏀",
  "🌊",
  "🐺",
  "🚴",
  "🍓",
  "☀️",
  "🪐",
  "🕊️",
  "⚔️",
  "🌈",
  "🍋",
  "🎀",
  "🦖",
  "🎧",
  "🧠",
  "🏎️",
  "👑",
  "🐻",
  "🦈",
  "🌵",
  "🎭",
  "🦜",
  "🐬",
  "🌻",
  "🎪",
  "🦩",
];

interface AddPlayerModalProps {
  existingIcons: string[]; // TODO(api): fetch via GET /api/players and map to icons
  onClose: () => void;
  onCreated: (player: { id: string; name: string; icon: string }) => void;
}

export function AddPlayerModal({
  existingIcons,
  onClose,
  onCreated,
}: AddPlayerModalProps) {
  const [tab, setTab] = useState<"emoji" | "image">("emoji");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Player name cannot be empty.");

    const icon = tab === "emoji" ? emoji.trim() : imageDataUrl;
    if (!icon)
      return setError(
        `Please ${tab === "emoji" ? "select or enter an emoji" : "upload an image"}.`,
      );
    if (tab === "emoji" && existingIcons.includes(icon)) {
      return setError(
        "That icon is already used by another player. Please choose a different one.",
      );
    }

    setSubmitting(true);
    try {
      // TODO(storage): for tab === 'image', upload `imageDataUrl` to Supabase
      // Storage first and pass the resulting public URL as `icon` instead of
      // a base64 data URL — matches the plan's Section 3.2 recommendation.
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to add player.");
      }
      onCreated(await res.json());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="➕ Add New Player" onClose={onClose}>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">
        Player name
      </label>
      <input
        className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        placeholder="Enter player name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-400">
        Player icon
      </label>
      <div className="mb-3 flex gap-1 rounded-lg bg-ink-50 p-1">
        <button
          className={clsx(
            "flex-1 rounded-md py-1.5 text-sm font-semibold",
            tab === "emoji" ? "bg-brand-500 text-white" : "text-ink-500",
          )}
          onClick={() => setTab("emoji")}
        >
          😀 Emoji
        </button>
      </div>

      <>
        <input
          className="mb-3 w-full rounded-lg border border-ink-100 px-3 py-2 text-center text-lg focus:border-brand-500 focus:outline-none"
          placeholder="Paste or type emoji…"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
        />
        <div className="grid grid-cols-8 gap-2">
          {QUICK_EMOJI.map((e) => {
            const used = existingIcons.includes(e);
            return (
              <button
                key={e}
                disabled={used}
                title={used ? "Already in use" : `Select ${e}`}
                onClick={() => setEmoji(e)}
                className={clsx(
                  "flex h-9 items-center justify-center rounded-lg border text-lg",
                  used
                    ? "cursor-not-allowed border-ink-100 opacity-30"
                    : emoji === e
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-100 hover:border-brand-500",
                )}
              >
                {e}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowFullPicker((v) => !v)}
          className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
        >
          {showFullPicker ? "▲ Hide full emoji list" : "🔍 Browse all emojis…"}
        </button>

        {showFullPicker && (
          <div className="mt-2 overflow-hidden rounded-lg border border-ink-100">
            <FullEmojiPicker
              width="100%"
              height={320}
              previewConfig={{ showPreview: false }}
              onEmojiClick={(data: EmojiClickData) => {
                if (existingIcons.includes(data.emoji)) {
                  setError(
                    "That icon is already used by another player. Please choose a different one.",
                  );
                  return;
                }
                setError(null);
                setEmoji(data.emoji);
                setShowFullPicker(false);
              }}
            />
          </div>
        )}
      </>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-lose">
          ⚠️ {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Adding…" : "Add Player"}
        </Button>
      </div>
    </Modal>
  );
}
