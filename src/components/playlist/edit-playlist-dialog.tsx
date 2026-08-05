"use client";

/**
 * Shared "Edit playlist" dialog (Slice 4.5) — mirrors CreatePlaylistDialog.
 * Controlled: the parent owns the trigger + open state. Fields are seeded from
 * the current playlist each time it opens; the form resets on open.
 *
 * Uses useUpdatePlaylist (optimistic across both cache keys). Two guard rails:
 *   1. If nothing actually changed (name and description match the stored
 *      values), we close WITHOUT firing a mutation — no-op patches are wasted
 *      server round-trips that bump updated_at for nothing (A3).
 *   2. Submission awaits the mutation (mutateAsync) — the dialog closes only
 *      on server success, staying open with an inline error otherwise.
 */
import { useEffect, useState } from "react";
import { useUpdatePlaylist } from "@/hooks/use-playlists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Playlist } from "@/types/playlist";

interface EditPlaylistDialogProps {
  playlist: Playlist;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPlaylistDialog({
  playlist,
  open,
  onOpenChange,
}: EditPlaylistDialogProps) {
  const updatePlaylist = useUpdatePlaylist();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the current playlist each time the dialog opens.
  useEffect(() => {
    if (open) {
      setName(playlist.name);
      setDescription(playlist.description ?? "");
      setError(null);
    }
  }, [open, playlist.name, playlist.description]);

  const originalName = playlist.name;
  const originalDescription = playlist.description ?? "";
  const canSubmit = name.trim().length > 0 && !updatePlaylist.isPending;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || updatePlaylist.isPending) return;

    const trimmedDescription = description.trim();

    // No actual changes → just close. Don't fire a patch that changes nothing.
    if (trimmedName === originalName && trimmedDescription === originalDescription) {
      onOpenChange(false);
      return;
    }

    setError(null);
    try {
      await updatePlaylist.mutateAsync({
        playlistId: playlist.id,
        input: {
          name: trimmedName,
          description: trimmedDescription || null,
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update playlist");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit playlist</DialogTitle>
          <DialogDescription>Change the name and description.</DialogDescription>
        </DialogHeader>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Playlist"
            maxLength={100}
            aria-label="Name"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Description (optional)
          </span>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's in this playlist?"
            maxLength={500}
            aria-label="Description"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={updatePlaylist.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            aria-disabled={updatePlaylist.isPending}
            className="rounded-full"
          >
            {updatePlaylist.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}