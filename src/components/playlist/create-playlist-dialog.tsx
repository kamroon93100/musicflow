"use client";

/**
 * Shared "Create playlist" dialog (Slice 4.5) — used by the sidebar and the
 * library page. Controlled: the parent owns the trigger button + open state
 * (base-ui Dialog.Root pattern from the full-screen player; avoids trigger
 * render juggling). Name required, description optional. Closes + resets the
 * form on success; shows an inline error on failure.
 *
 * The create action (useCreatePlaylist) invalidates ["playlists"], so both the
 * sidebar list and the library grid refetch automatically.
 */
import { useEffect, useState } from "react";
import { useCreatePlaylist } from "@/hooks/use-playlists";
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

interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional — fires with the created playlist right before closing. Used by
   *  the search "Add to playlist" flow to chain-add the current track. */
  onCreated?: (playlist: Playlist) => void;
}

export function CreatePlaylistDialog({
  open,
  onOpenChange,
  onCreated,
}: CreatePlaylistDialogProps) {
  const createPlaylist = useCreatePlaylist();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the form + error each time the dialog opens (fresh state per launch).
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && !createPlaylist.isPending;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || createPlaylist.isPending) return;
    createPlaylist.mutate(
      { name: trimmed, description: description.trim() || undefined },
      {
        onSuccess: (created) => {
          onOpenChange(false);
          onCreated?.(created);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Failed to create playlist"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create playlist</DialogTitle>
          <DialogDescription>Give your playlist a name.</DialogDescription>
        </DialogHeader>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Playlist"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
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
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createPlaylist.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full"
          >
            {createPlaylist.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
